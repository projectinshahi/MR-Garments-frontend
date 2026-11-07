import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { UnitRow } from "@/lib/api/types";

import { UNIT_TEXT, UnitDialog } from "./units-dialog";

const nav = vi.hoisted(() => ({ query: "dialog=add", router: { refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/units",
  useRouter: () => nav.router,
  useSearchParams: () => new URLSearchParams(nav.query),
}));
const replaceState = vi.spyOn(window.history, "replaceState");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

const post = vi.mocked(apiClient.post);
const patch = vi.mocked(apiClient.patch);
const remove = vi.mocked(apiClient.delete);
const TAKEN = "A unit with this name already exists.";
const PIECES: UnitRow = { id: "u-1", name: "Pieces", symbol: "pcs", usedByItems: ["Denim jeans", "Polo shirts"], status: "Active" };

function open(query: string) {
  nav.query = query;
  const user = userEvent.setup();
  render(<UnitDialog rows={[PIECES]} />);
  // Prefix match: "Unit name" is followed by the required mark.
  const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`));
  const save = screen.getByRole("button", { name: "Save unit" });
  return { user, field, save };
}

beforeEach(() => vi.clearAllMocks());

describe("Add unit", () => {
  it("opens empty, posts the trimmed name and symbol, then toasts, closes and reloads", async () => {
    post.mockResolvedValue({ unit: { ...PIECES, id: "u-3", name: "Kilograms", symbol: "kg", usedByItems: [] } });
    const { user, field, save } = open("dialog=add");
    expect(screen.getByRole("dialog", { name: "Add unit" })).toBeVisible();
    expect(field("Unit name")).toHaveValue("");
    expect(field("Symbol")).toHaveValue("");
    expect(screen.queryByLabelText("Status")).toBeNull();

    await user.type(field("Unit name"), " Kilograms ");
    await user.type(field("Symbol"), " kg ");
    await user.click(save);

    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledWith("/units", { name: "Kilograms", symbol: "kg" });
    expect(toast.success).toHaveBeenCalledWith("Unit added");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/settings/units");
  });

  it("asks for the name (the symbol is optional) without calling the API", async () => {
    const { user, field, save } = open("dialog=add");
    await user.click(save);
    expect(await screen.findByText(UNIT_TEXT.nameEmpty)).toBeVisible();
    expect(field("Unit name")).toHaveFocus();
    expect(post).not.toHaveBeenCalled();
  });

  it("shows a duplicate name under Unit name, keeping the value", async () => {
    post.mockRejectedValue(new ApiError(409, "name_exists", TAKEN, { name: TAKEN }));
    const { user, field, save } = open("dialog=add");
    await user.type(field("Unit name"), "PIECES");
    await user.click(save);

    expect(await screen.findByText(TAKEN)).toBeVisible();
    expect(field("Unit name")).toHaveValue("PIECES");
    expect(field("Unit name")).toHaveFocus();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("Edit unit", () => {
  it("opens with the row's values and patches name, symbol and status", async () => {
    patch.mockResolvedValue({ unit: { ...PIECES, name: "Pcs" } });
    const { user, field, save } = open("dialog=edit&id=u-1");
    expect(screen.getByRole("dialog", { name: "Edit unit" })).toBeVisible();
    expect(field("Unit name")).toHaveValue("Pieces");
    expect(field("Symbol")).toHaveValue("pcs");
    expect(field("Status")).toHaveValue("Active");
    await user.clear(field("Unit name"));
    await user.type(field("Unit name"), "Pcs");
    await user.click(save);

    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/units/u-1", { name: "Pcs", symbol: "pcs", status: "Active" });
    expect(toast.success).toHaveBeenCalledWith("Unit saved");
  });

  it("asks before deactivating: Cancel saves nothing, Deactivate patches the status", async () => {
    patch.mockResolvedValue({ unit: { ...PIECES, status: "Inactive" } });
    const { user, field, save } = open("dialog=edit&id=u-1");
    await user.selectOptions(field("Status"), "Inactive");
    await user.click(save);

    const confirm = await screen.findByRole("alertdialog", { name: "Deactivate unit?" });
    expect(confirm).toHaveTextContent("Are you sure you want to deactivate Pieces?");
    expect(confirm).toHaveTextContent("Items that already use it keep it.");
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog", { name: "Deactivate unit?" })).toBeNull());
    expect(patch).not.toHaveBeenCalled();

    await user.click(save);
    await user.click(within(await screen.findByRole("alertdialog", { name: "Deactivate unit?" })).getByRole("button", { name: "Deactivate unit" }));
    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/units/u-1", { name: "Pieces", symbol: "pcs", status: "Inactive" });
  });

  it("Delete asks first with the unit's facts; a unit in use is offered Deactivate instead", async () => {
    remove.mockRejectedValue(new ApiError(409, "in_use", "This unit is used by 2 items, so it can't be deleted. Deactivate it instead."));
    patch.mockResolvedValue({ unit: { ...PIECES, status: "Inactive" } });
    const { user } = open("dialog=edit&id=u-1");
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Delete unit?" });
    expect(confirm).toHaveTextContent("TypeUnitNamePiecesReferenceu-1SymbolpcsUsed by itemsDenim jeans, Polo shirts");
    await user.click(within(confirm).getByRole("button", { name: "Delete unit" }));

    const instead = await screen.findByRole("alertdialog", { name: "Deactivate unit instead?" });
    expect(instead).toHaveTextContent("This unit is used by 2 items, so it can't be deleted.");
    await user.click(within(instead).getByRole("button", { name: "Deactivate unit" }));
    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(remove).toHaveBeenCalledWith("/units/u-1");
    expect(patch).toHaveBeenCalledWith("/units/u-1", { status: "Inactive" });
    expect(toast.success).toHaveBeenCalledWith("Unit deactivated");
  });
});
