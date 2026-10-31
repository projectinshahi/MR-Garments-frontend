import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { ItemRow } from "@/lib/api/types";

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
const JEANS: ItemRow = {
  id: "i-1",
  name: "Denim jeans",
  countedIn: "Pieces",
  perBundle: 50,
  bundleLabel: null,
  usedInOrders: ["PO-2028", "PO-2050"],
  status: "Active",
};
const FABRIC: ItemRow = { id: "i-8", name: "Cotton fabric", countedIn: "Metres", perBundle: null, bundleLabel: "Roll", usedInOrders: [], status: "Active" };
const saved = { item: JEANS };

function open(query: string) {
  nav.query = query;
  const user = userEvent.setup();
  render(<ItemDialog rows={[JEANS, FABRIC]} />);
  // Prefix match: required labels are followed by the required mark.
  const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`));
  const save = () => screen.getByRole("button", { name: "Save item" });
  return { user, field, save };
}

beforeEach(() => vi.clearAllMocks());

describe("Add item", () => {
  it("opens empty with no unit chosen and no Status", () => {
    const { field } = open("dialog=add");
    expect(screen.getByRole("dialog", { name: "Add item" })).toBeVisible();
    for (const label of ["Item name", "Counted in", "Pieces per bundle", "Bundle label"]) expect(field(label)).toHaveValue("");
    expect(field("Counted in")).toBeEnabled();
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
  });

  it("posts pieces per bundle as a number, then toasts, closes and reloads the list", async () => {
    post.mockResolvedValue(saved);
    const { user, field, save } = open("dialog=add");
    await user.type(field("Item name"), " Ladies blazers ");
    await user.selectOptions(field("Counted in"), "Pieces");
    await user.type(field("Pieces per bundle"), "25");
    await user.click(save());

    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    // No status: the API's create body refuses one (new items start Active).
    expect(post).toHaveBeenCalledWith("/items", { name: "Ladies blazers", countedIn: "Pieces", perBundle: 25, bundleLabel: null });
    expect(toast.success).toHaveBeenCalledWith("Item added");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/settings/items");
  });

  it("posts a bundle label instead, the pieces per bundle null", async () => {
    post.mockResolvedValue(saved);
    const { user, field, save } = open("dialog=add");
    await user.type(field("Item name"), "Linen fabric");
    await user.selectOptions(field("Counted in"), "Metres");
    await user.type(field("Bundle label"), "Bale");
    await user.click(save());

    await waitFor(() => expect(post).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledWith("/items", expect.objectContaining({ countedIn: "Metres", perBundle: null, bundleLabel: "Bale" }));
  });

  it("shows every missing field at once without calling the API", async () => {
    const { user, field, save } = open("dialog=add");
    await user.click(save());

    for (const message of [MESSAGES.name, MESSAGES.countedIn, MESSAGES.bundle]) expect(await screen.findByText(message)).toBeVisible();
    expect(field("Item name")).toHaveFocus();
    expect(field("Pieces per bundle")).toHaveAttribute("aria-invalid", "true");
    expect(post).not.toHaveBeenCalled();
  });

  it("disables Save while the request runs", async () => {
    let finish: (value: typeof saved) => void = () => {};
    post.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { user, field, save } = open("dialog=add");
    await user.type(field("Item name"), "Scarves");
    await user.selectOptions(field("Counted in"), "Pieces");
    await user.type(field("Pieces per bundle"), "20");
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
    await user.type(field("Pieces per bundle"), "50");
    await user.click(save());

    expect(await screen.findByText(taken)).toBeVisible();
    expect(field("Item name")).toHaveValue("denim JEANS");
    expect(field("Item name")).toHaveFocus();
    expect(toast.success).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();

    post.mockRejectedValue(new ApiError(422, "validation_failed", "Some fields need attention.", { perBundle: MESSAGES.bundle }));
    await user.clear(field("Item name"));
    await user.type(field("Item name"), "Scarves");
    await user.click(save());
    expect(await screen.findByText(MESSAGES.bundle)).toBeVisible();
    expect(field("Pieces per bundle")).toHaveFocus();
  });
});

describe("Edit item", () => {
  it("opens with the row's values; an item on an order keeps its unit, which isn't sent", async () => {
    patch.mockResolvedValue(saved);
    const { user, field, save } = open("dialog=edit&id=i-1");
    expect(screen.getByRole("dialog", { name: "Edit item" })).toBeVisible();
    expect(field("Item name")).toHaveValue("Denim jeans");
    expect(field("Counted in")).toHaveValue("Pieces");
    expect(field("Counted in")).toBeDisabled();
    expect(field("Counted in")).toHaveAccessibleDescription("On an order, so it can't change.");
    expect(field("Pieces per bundle")).toHaveValue("50");
    expect(field("Bundle label")).toHaveValue("");
    expect(field("Status")).toHaveValue("Active");

    // Switching to a bundle label: clear the number, type the label.
    await user.clear(field("Pieces per bundle"));
    await user.type(field("Bundle label"), "Bale");
    await user.click(save());

    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/items/i-1", { name: "Denim jeans", perBundle: null, bundleLabel: "Bale", status: "Active" });
    expect(toast.success).toHaveBeenCalledWith("Item saved");
  });

  it("lets the unit of an item on no order change", async () => {
    patch.mockResolvedValue(saved);
    const { user, field, save } = open("dialog=edit&id=i-8");
    expect(field("Counted in")).toBeEnabled();
    expect(screen.queryByText("On an order, so it can't change.")).not.toBeInTheDocument();
    await user.selectOptions(field("Counted in"), "Pieces");
    await user.clear(field("Bundle label"));
    await user.type(field("Pieces per bundle"), "40");
    await user.click(save());

    await waitFor(() => expect(patch).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/items/i-8", { name: "Cotton fabric", countedIn: "Pieces", perBundle: 40, bundleLabel: null, status: "Active" });
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
  const input = { name: "Scarves", countedIn: "Pieces", perBundle: "", bundleLabel: "", status: "Active" as const };
  const errors = (overrides: object) => itemSchema.safeParse({ ...input, ...overrides }).error?.issues.map((issue) => [issue.path[0], issue.message]);

  it("needs exactly one of pieces per bundle and a bundle label", () => {
    expect(errors({})).toEqual([["perBundle", MESSAGES.bundle]]);
    expect(errors({ perBundle: "20", bundleLabel: "Box" })).toEqual([["perBundle", MESSAGES.bundle]]);
    expect(errors({ bundleLabel: "  " })).toEqual([["perBundle", MESSAGES.bundle]]);
    expect(itemSchema.parse({ ...input, perBundle: " 100000 " })).toEqual({ ...input, perBundle: 100_000, bundleLabel: null });
    expect(itemSchema.parse({ ...input, bundleLabel: " Roll " })).toEqual({ ...input, perBundle: null, bundleLabel: "Roll" });
  });

  it("takes a whole number of pieces from 1 to 100000", () => {
    for (const perBundle of ["0", "1.5", "-3", "100001", "abc", "1e3"]) expect(errors({ perBundle })?.[0], perBundle).toEqual(["perBundle", MESSAGES.perBundle]);
  });

  it("checks the name and the unit", () => {
    expect(errors({ name: " ", perBundle: "5" })).toEqual([["name", MESSAGES.name]]);
    expect(errors({ name: "x".repeat(201), perBundle: "5" })).toEqual([["name", MESSAGES.nameTooLong]]);
    expect(errors({ countedIn: "", perBundle: "5" })).toEqual([["countedIn", MESSAGES.countedIn]]);
  });
});
