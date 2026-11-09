import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { ItemRow, UnitRow } from "@/lib/api/types";

import { ItemDialog, itemSchema, MESSAGES } from "./items-dialog";

const nav = vi.hoisted(() => ({ query: "dialog=add", router: { refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/items",
  useRouter: () => nav.router,
  useSearchParams: () => new URLSearchParams(nav.query),
}));
const replaceState = vi.spyOn(window.history, "replaceState");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn(), patch: vi.fn() } }));

const post = vi.mocked(apiClient.post);
const patch = vi.mocked(apiClient.patch);
const JEANS: ItemRow = { id: "i-1", name: "Denim jeans", countedIn: "Pieces", price: null, usedInOrders: ["PO-2028", "PO-2050"], status: "Active" };
const FABRIC: ItemRow = { id: "i-8", name: "Cotton fabric", countedIn: "Metres", price: 8.25, usedInOrders: [], status: "Active" };
const YARN: ItemRow = { id: "i-9", name: "Yarn", countedIn: "Kilograms", price: null, usedInOrders: [], status: "Active" };
const unit = (id: string, name: string, symbol: string, status: UnitRow["status"] = "Active"): UnitRow => ({ id, name, symbol, usedByItems: [], status });
// Kilograms is inactive: offered to no new item, kept by Yarn.
const UNITS = [unit("u-1", "Pieces", "pcs"), unit("u-2", "Metres", "m"), unit("u-3", "Kilograms", "kg", "Inactive"), unit("u-4", "Rolls", "")];
const saved = { item: JEANS };

function open(query: string) {
  nav.query = query;
  const user = userEvent.setup();
  render(<ItemDialog rows={[JEANS, FABRIC, YARN]} units={UNITS} />);
  // Prefix match: required labels are followed by the required mark.
  const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`));
  const save = () => screen.getByRole("button", { name: "Save item" });
  return { user, field, save };
}

beforeEach(() => vi.clearAllMocks());

describe("Add item", () => {
  it("opens empty with no unit chosen, no price and no Status, offering the active units from Settings", () => {
    const { field } = open("dialog=add");
    expect(screen.getByRole("dialog", { name: "Add item" })).toBeVisible();
    for (const label of ["Item name", "Counted in", "Item price"]) expect(field(label)).toHaveValue("");
    expect(field("Item price")).toHaveAccessibleDescription("Fills the rate on a new order, in the order's currency; leave empty if none.");
    expect(screen.queryByLabelText(/Pieces per bundle|Bundle label/)).not.toBeInTheDocument();
    expect(field("Counted in")).toBeEnabled();
    expect([...(field("Counted in") as HTMLSelectElement).options].map((option) => option.textContent)).toEqual(["Select unit", "Pieces", "Metres", "Rolls"]);
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
  });

  it("posts the price as a number (grouping allowed), then toasts, closes and reloads the list", async () => {
    post.mockResolvedValue(saved);
    const { user, field, save } = open("dialog=add");
    await user.type(field("Item name"), " Ladies blazers ");
    await user.selectOptions(field("Counted in"), "Pieces");
    await user.type(field("Item price"), "1,250.50");
    await user.click(save());

    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    // No status: the API's create body refuses one (new items start Active).
    expect(post).toHaveBeenCalledWith("/items", { name: "Ladies blazers", countedIn: "Pieces", price: 1250.5 });
    expect(toast.success).toHaveBeenCalledWith("Item added");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/settings/items");
  });

  it("posts no price (null) when the field is left empty", async () => {
    post.mockResolvedValue(saved);
    const { user, field, save } = open("dialog=add");
    await user.type(field("Item name"), "Linen fabric");
    await user.selectOptions(field("Counted in"), "Metres");
    await user.click(save());

    await waitFor(() => expect(post).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledWith("/items", { name: "Linen fabric", countedIn: "Metres", price: null });
  });

  it("shows every problem at once without calling the API: missing name and unit, a negative price", async () => {
    const { user, field, save } = open("dialog=add");
    await user.type(field("Item price"), "-5");
    await user.click(save());

    for (const message of [MESSAGES.name, MESSAGES.countedIn, MESSAGES.price]) expect(await screen.findByText(message)).toBeVisible();
    expect(field("Item name")).toHaveFocus();
    expect(field("Item price")).toHaveAttribute("aria-invalid", "true");
    expect(post).not.toHaveBeenCalled();
  });

  it("disables Save while the request runs", async () => {
    let finish: (value: typeof saved) => void = () => {};
    post.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { user, field, save } = open("dialog=add");
    await user.type(field("Item name"), "Scarves");
    await user.selectOptions(field("Counted in"), "Pieces");
    await user.type(field("Item price"), "20");
    await user.click(save());
    await waitFor(() => expect(save()).toBeDisabled());
    finish(saved);
    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
  });

  it("shows the API's field errors under their fields, keeping the values", async () => {
    const taken = "An item with this name already exists.";
    post.mockRejectedValue(new ApiError(409, "name_exists", taken, { name: taken }));
    const { user, field, save } = open("dialog=add");
    await user.type(field("Item name"), "denim JEANS");
    await user.selectOptions(field("Counted in"), "Pieces");
    await user.type(field("Item price"), "50");
    await user.click(save());

    expect(await screen.findByText(taken)).toBeVisible();
    expect(field("Item name")).toHaveValue("denim JEANS");
    expect(field("Item price")).toHaveValue("50");
    expect(field("Item name")).toHaveFocus();
    expect(toast.success).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();

    post.mockRejectedValue(new ApiError(422, "validation_failed", "Some fields need attention.", { price: MESSAGES.price }));
    await user.clear(field("Item name"));
    await user.type(field("Item name"), "Scarves");
    await user.click(save());
    expect(await screen.findByText(MESSAGES.price)).toBeVisible();
    expect(field("Item price")).toHaveFocus();
  });
});

describe("Edit item", () => {
  it("opens with the row's values; an item on an order keeps its unit, which isn't sent; the price can be set", async () => {
    patch.mockResolvedValue(saved);
    const { user, field, save } = open("dialog=edit&id=i-1");
    expect(screen.getByRole("dialog", { name: "Edit item" })).toBeVisible();
    expect(field("Item name")).toHaveValue("Denim jeans");
    expect(field("Counted in")).toHaveValue("Pieces");
    expect(field("Counted in")).toBeDisabled();
    expect(field("Counted in")).toHaveAccessibleDescription("On an order, so it can't change.");
    expect(field("Item price")).toHaveValue("");
    expect(field("Status")).toHaveValue("Active");

    await user.type(field("Item price"), "12.5");
    await user.click(save());

    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/items/i-1", { name: "Denim jeans", price: 12.5, status: "Active" });
    expect(toast.success).toHaveBeenCalledWith("Item saved");
  });

  it("shows the saved price, changes it, and clears it with an empty field", async () => {
    patch.mockResolvedValue({ item: FABRIC });
    const { user, field, save } = open("dialog=edit&id=i-8");
    expect(field("Item price")).toHaveValue("8.25");
    await user.clear(field("Item price"));
    await user.type(field("Item price"), "9");
    await user.click(save());
    await waitFor(() => expect(patch).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/items/i-8", { name: "Cotton fabric", countedIn: "Metres", price: 9, status: "Active" });

    await user.clear(field("Item price"));
    await user.click(save());
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(patch).toHaveBeenLastCalledWith("/items/i-8", { name: "Cotton fabric", countedIn: "Metres", price: null, status: "Active" });
  });

  it("keeps an item's unit that has since been deactivated, still selected and offered", async () => {
    patch.mockResolvedValue({ item: YARN });
    const { user, field, save } = open("dialog=edit&id=i-9");
    expect(field("Counted in")).toHaveValue("Kilograms");
    expect([...(field("Counted in") as HTMLSelectElement).options].map((option) => option.textContent)).toEqual(["Pieces", "Metres", "Rolls", "Kilograms"]);
    await user.type(field("Item price"), "3");
    await user.click(save());
    await waitFor(() => expect(patch).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/items/i-9", { name: "Yarn", countedIn: "Kilograms", price: 3, status: "Active" });
  });

  it("lets the unit of an item on no order change", async () => {
    patch.mockResolvedValue(saved);
    const { user, field, save } = open("dialog=edit&id=i-8");
    expect(field("Counted in")).toBeEnabled();
    expect(screen.queryByText("On an order, so it can't change.")).not.toBeInTheDocument();
    await user.selectOptions(field("Counted in"), "Pieces");
    await user.click(save());

    await waitFor(() => expect(patch).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/items/i-8", { name: "Cotton fabric", countedIn: "Pieces", price: 8.25, status: "Active" });
  });

  it("asks before deactivating, and saves only once confirmed", async () => {
    patch.mockResolvedValue(saved);
    const { user, field, save } = open("dialog=edit&id=i-1");
    await user.selectOptions(field("Status"), "Inactive");
    await user.click(save());

    const confirm = await screen.findByRole("alertdialog", { name: "Deactivate item?" });
    expect(confirm).toHaveTextContent("Are you sure you want to deactivate Denim jeans?");
    expect(confirm).toHaveTextContent("An inactive item no longer appears on new orders.");
    expect(patch).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog", { name: "Deactivate item?" })).not.toBeInTheDocument());
    expect(patch).not.toHaveBeenCalled();

    await user.click(save());
    await user.click(await screen.findByRole("button", { name: "Deactivate item" }));
    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/items/i-1", expect.objectContaining({ status: "Inactive" }));
    expect(toast.success).toHaveBeenCalledWith("Item saved");
  });

  it("opens nothing for an id that isn't in the list", () => {
    open("dialog=edit&id=missing");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("itemSchema", () => {
  const input = { name: "Scarves", countedIn: "Pieces", price: "", status: "Active" as const };
  const errors = (overrides: object) => itemSchema.safeParse({ ...input, ...overrides }).error?.issues.map((issue) => [issue.path[0], issue.message]);

  it("takes no price, or 0 or more to 2 decimals with optional grouping, as a number", () => {
    expect(itemSchema.parse(input)).toEqual({ name: "Scarves", countedIn: "Pieces", price: null, status: "Active" });
    for (const [text, price] of [["0", 0], ["12", 12], ["12.5", 12.5], [" 12.50 ", 12.5], ["1,250.50", 1250.5]] as const) {
      expect(itemSchema.parse({ ...input, price: text }).price, text).toBe(price);
    }
  });

  it("refuses a negative price, more than 2 decimals or text", () => {
    for (const price of ["-1", "1.234", "abc", "1e3", "12,5", "."]) expect(errors({ price }), price).toEqual([["price", MESSAGES.price]]);
  });

  it("checks the name and the unit", () => {
    expect(errors({ name: " " })).toEqual([["name", MESSAGES.name]]);
    expect(errors({ name: "x".repeat(201) })).toEqual([["name", MESSAGES.nameTooLong]]);
    expect(errors({ countedIn: "" })).toEqual([["countedIn", MESSAGES.countedIn]]);
  });
});
