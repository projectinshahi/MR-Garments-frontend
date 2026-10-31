import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { LocationRow } from "@/lib/api/types";

import { OfficeDialog } from "./offices-dialog";

const nav = vi.hoisted(() => ({ query: "dialog=add", router: { refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/offices",
  useRouter: () => nav.router,
  useSearchParams: () => new URLSearchParams(nav.query),
}));
const replaceState = vi.spyOn(window.history, "replaceState");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn(), patch: vi.fn() } }));

const post = vi.mocked(apiClient.post);
const patch = vi.mocked(apiClient.patch);
const TAKEN = "An office or warehouse with this name already exists.";
const WAREHOUSE: LocationRow = {
  id: "l-3",
  name: "Main warehouse",
  type: "Warehouse",
  country: "India",
  address: "Kochi",
  staff: ["Joseph M"],
  status: "Active",
};

function open(query: string) {
  nav.query = query;
  const user = userEvent.setup();
  render(<OfficeDialog rows={[WAREHOUSE]} />);
  // Prefix match: "Name" and "Type" are followed by the required mark.
  const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`));
  const save = screen.getByRole("button", { name: "Save office or warehouse" });
  return { user, field, save };
}

beforeEach(() => vi.clearAllMocks());

describe("Add office or warehouse", () => {
  it("opens empty, posts the trimmed name, type and address, then toasts, closes and reloads", async () => {
    post.mockResolvedValue({ location: { ...WAREHOUSE, id: "l-4", name: "Yiwu office" } });
    const { user, field, save } = open("dialog=add");
    expect(screen.getByRole("dialog", { name: "Add office or warehouse" })).toBeVisible();
    expect(field("Name")).toHaveValue("");
    expect(field("Type")).toHaveValue("");
    expect(within(field("Type")).getAllByRole("option").map((option) => option.textContent)).toEqual(["", "China office", "India office", "Warehouse"]);
    expect(screen.queryByLabelText("Status")).toBeNull();

    await user.type(field("Name"), " Yiwu office ");
    await user.selectOptions(field("Type"), "China office");
    await user.type(field("Address"), "12 Futian Road");
    await user.click(save);

    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledWith("/locations", { name: "Yiwu office", type: "China office", address: "12 Futian Road" });
    expect(toast.success).toHaveBeenCalledWith("Office or warehouse added");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/settings/offices");
  });

  it("asks for the name and the type without calling the API", async () => {
    const { user, field, save } = open("dialog=add");
    await user.click(save);
    expect(await screen.findByText("Enter the office or warehouse name.")).toBeVisible();
    expect(screen.getByText("Choose a type.")).toBeVisible();
    expect(field("Name")).toHaveFocus();
    expect(post).not.toHaveBeenCalled();
  });

  it("shows a duplicate name under Name, keeping the values, and disables Save only while saving", async () => {
    let fail: (error: unknown) => void = () => {};
    post.mockReturnValue(new Promise((_, reject) => (fail = reject)));
    const { user, field, save } = open("dialog=add");
    await user.type(field("Name"), "main WAREHOUSE");
    await user.selectOptions(field("Type"), "Warehouse");
    await user.click(save);
    await waitFor(() => expect(save).toBeDisabled());
    fail(new ApiError(409, "name_exists", TAKEN, { name: TAKEN }));

    expect(await screen.findByText(TAKEN)).toBeVisible();
    expect(field("Name")).toHaveValue("main WAREHOUSE");
    expect(field("Name")).toHaveFocus();
    expect(field("Type")).toHaveValue("Warehouse");
    expect(save).toBeEnabled();
    expect(replaceState).not.toHaveBeenCalled();
  });
});

describe("Edit office or warehouse", () => {
  it("shows the saved values with the type read-only, and patches name, address and status", async () => {
    patch.mockResolvedValue({ location: { ...WAREHOUSE, address: "Willingdon Island" } });
    const { user, field, save } = open("dialog=edit&id=l-3");
    expect(screen.getByRole("dialog", { name: "Edit office or warehouse" })).toBeVisible();
    expect(field("Name")).toHaveValue("Main warehouse");
    expect(field("Type")).toHaveValue("Warehouse");
    expect(field("Type")).toHaveAttribute("readonly");
    expect(field("Status")).toHaveValue("Active");

    await user.clear(field("Address"));
    await user.type(field("Address"), "Willingdon Island");
    await user.click(save);

    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/locations/l-3", { name: "Main warehouse", address: "Willingdon Island", status: "Active" });
    expect(toast.success).toHaveBeenCalledWith("Office or warehouse saved");
  });

  it("asks before deactivating: Cancel saves nothing, Deactivate patches the status", async () => {
    patch.mockResolvedValue({ location: { ...WAREHOUSE, status: "Inactive" } });
    const { user, field, save } = open("dialog=edit&id=l-3");
    await user.selectOptions(field("Status"), "Inactive");
    await user.click(save);

    const confirm = await screen.findByRole("alertdialog", { name: "Deactivate office or warehouse?" });
    expect(confirm).toHaveTextContent("Are you sure you want to deactivate Main warehouse?");
    expect(confirm).toHaveTextContent("no longer appears when recording receipts or assigning users");
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog", { name: "Deactivate office or warehouse?" })).toBeNull());
    expect(patch).not.toHaveBeenCalled();

    await user.click(save);
    await user.click(within(await screen.findByRole("alertdialog", { name: "Deactivate office or warehouse?" })).getByRole("button", { name: "Deactivate office or warehouse" }));
    await waitFor(() => expect(nav.router.refresh).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/locations/l-3", { name: "Main warehouse", address: "Kochi", status: "Inactive" });
    expect(toast.success).toHaveBeenCalledWith("Office or warehouse saved");
  });

  it("stays closed for an id that isn't in the list", () => {
    nav.query = "dialog=edit&id=missing";
    render(<OfficeDialog rows={[WAREHOUSE]} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
