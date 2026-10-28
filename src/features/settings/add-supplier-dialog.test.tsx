import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { SupplierRow } from "@/lib/api/types";

import { SupplierDialog } from "./add-supplier-dialog";
import { supplierDraft } from "./data/fixtures";

const nav = vi.hoisted(() => ({ query: "dialog=add", router: { replace: vi.fn(), refresh: vi.fn() } }));
const router = nav.router;
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/suppliers",
  useRouter: () => nav.router,
  useSearchParams: () => new URLSearchParams(nav.query),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn(), patch: vi.fn() } }));

const post = vi.mocked(apiClient.post);
const patch = vi.mocked(apiClient.patch);
const M22 = "A supplier with this name already exists.";
const NINGBO = {
  name: "Ningbo Denim Works",
  city: "Ningbo",
  contactPerson: "Mr. Xu Feng",
  phone: "+86 138 5740 9921",
  currency: "CNY" as const,
  address: "88 Zhongshan Road, Ningbo",
  notes: "Denim only",
};
const saved: { supplier: SupplierRow } = { supplier: { ...NINGBO, id: "s-6", openOrders: 0, status: "Active" } };
const ROWS: SupplierRow[] = [saved.supplier, { ...saved.supplier, id: "s-7", name: "Wenzhou Buttons", status: "Inactive" }];

function open(query = "dialog=add") {
  nav.query = query;
  const user = userEvent.setup();
  render(<SupplierDialog draft={supplierDraft} suppliers={ROWS} />);
  // Prefix match: "Supplier name" is followed by the required mark.
  const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`));
  const save = screen.getByRole("button", { name: "Save supplier" });
  return { user, field, save };
}

beforeEach(() => vi.clearAllMocks());

// The dialog opens empty (user decision, 2026-10-26), so each test types what it needs.
describe("Add supplier", () => {
  it("opens empty, with yuan selected and no Status", () => {
    const { field } = open();
    expect(screen.getByRole("dialog", { name: "Add supplier" })).toBeVisible();
    for (const label of ["Supplier name", "City", "Contact person", "Phone / WeChat", "Address", "Notes"]) {
      expect(field(label)).toHaveValue("");
    }
    expect(field("Currency")).toHaveValue("CNY");
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
  });

  it("posts MD-2 with every field, then toasts, closes and reloads the list (K7)", async () => {
    post.mockResolvedValue(saved);
    const { user, field, save } = open();
    await user.type(field("Supplier name"), NINGBO.name);
    await user.type(field("City"), NINGBO.city);
    await user.type(field("Contact person"), NINGBO.contactPerson);
    await user.type(field("Phone / WeChat"), NINGBO.phone);
    await user.type(field("Address"), NINGBO.address);
    await user.type(field("Notes"), NINGBO.notes);
    await user.click(save);

    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledWith("/suppliers", NINGBO);
    expect(toast.success).toHaveBeenCalledWith("Supplier added");
    expect(router.replace).toHaveBeenCalledWith("/settings/suppliers", { scroll: false });
    expect(router.replace.mock.invocationCallOrder[0]).toBeLessThan(router.refresh.mock.invocationCallOrder[0]!);
  });

  it("disables Save while the request runs (E14)", async () => {
    let finish: (value: typeof saved) => void = () => {};
    post.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { user, field, save } = open();
    await user.type(field("Supplier name"), NINGBO.name);
    await user.click(save);
    await waitFor(() => expect(save).toBeDisabled());
    finish(saved);
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
  });

  it("shows M22 under Supplier name for a duplicate, keeping the values (E2)", async () => {
    post.mockRejectedValue(new ApiError(409, "name_exists", M22, { name: M22 }));
    const { user, field, save } = open();
    await user.type(field("Supplier name"), "ningbo denim works");
    await user.type(field("City"), NINGBO.city);
    await user.click(save);

    expect(await screen.findByText(M22)).toBeVisible();
    expect(field("Supplier name")).toHaveValue("ningbo denim works");
    expect(field("Supplier name")).toHaveFocus();
    expect(field("Supplier name")).toHaveAttribute("aria-invalid", "true");
    expect(field("City")).toHaveValue("Ningbo");
    expect(save).toBeEnabled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("shows M21 without calling the API when the name is empty (E1)", async () => {
    const { user, field, save } = open();
    await user.click(save);

    expect(await screen.findByText("Enter the supplier name.")).toBeVisible();
    expect(field("Supplier name")).toHaveFocus();
    expect(post).not.toHaveBeenCalled();
  });

  it("toasts M24 and keeps the dialog and values when the request fails (E12)", async () => {
    post.mockRejectedValue(new ApiError(0, "network_error", "Something went wrong."));
    const { user, field, save } = open();
    await user.type(field("Supplier name"), NINGBO.name);
    await user.click(save);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something went wrong.", { description: "Please try again." }));
    expect(screen.getByRole("dialog", { name: "Add supplier" })).toBeVisible();
    expect(field("Supplier name")).toHaveValue("Ningbo Denim Works");
    expect(save).toBeEnabled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("Edit supplier", () => {
  const EDIT = "dialog=edit&id=s-6";

  it("opens the Add form filled from the row, plus Status", () => {
    const { field, save } = open(EDIT);
    expect(screen.getByRole("dialog", { name: "Edit supplier" })).toBeVisible();
    expect(field("Supplier name")).toHaveValue(NINGBO.name);
    expect(field("City")).toHaveValue(NINGBO.city);
    expect(field("Contact person")).toHaveValue(NINGBO.contactPerson);
    expect(field("Phone / WeChat")).toHaveValue(NINGBO.phone);
    expect(field("Currency")).toHaveValue("CNY");
    expect(field("Address")).toHaveValue(NINGBO.address);
    expect(field("Notes")).toHaveValue(NINGBO.notes);
    expect(field("Status")).toHaveValue("Active");
    expect(save).toBeEnabled();
  });

  it("opens nothing for an id that isn't in the list", () => {
    nav.query = "dialog=edit&id=s-404";
    render(<SupplierDialog draft={supplierDraft} suppliers={ROWS} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("patches the editable fields and status (not the currency), then toasts Supplier saved, closes and reloads", async () => {
    patch.mockResolvedValue(saved);
    const { user, field, save } = open(EDIT);
    await user.clear(field("City"));
    await user.type(field("City"), " Shanghai ");
    await user.click(save);

    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/suppliers/s-6", {
      name: NINGBO.name,
      city: "Shanghai",
      contactPerson: NINGBO.contactPerson,
      phone: NINGBO.phone,
      address: NINGBO.address,
      notes: NINGBO.notes,
      status: "Active",
    });
    expect(post).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Supplier saved");
    expect(router.replace).toHaveBeenCalledWith("/settings/suppliers", { scroll: false });
  });

  it("asks before deactivating; Cancel keeps the dialog and saves nothing", async () => {
    const { user, field, save } = open(EDIT);
    await user.selectOptions(field("Status"), "Inactive");
    await user.click(save);

    const confirm = await screen.findByRole("dialog", { name: "Deactivate Ningbo Denim Works?" });
    expect(confirm).toHaveTextContent("It won't appear when a new order is created.");
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /Deactivate/ })).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "Edit supplier" })).toBeVisible();
    expect(field("Status")).toHaveValue("Inactive");
    expect(patch).not.toHaveBeenCalled();
  });

  it("saves the deactivation once confirmed", async () => {
    patch.mockResolvedValue({ supplier: { ...saved.supplier, status: "Inactive" } });
    const { user, field, save } = open(EDIT);
    await user.selectOptions(field("Status"), "Inactive");
    await user.click(save);
    await user.click(await screen.findByRole("button", { name: "Deactivate" }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/suppliers/s-6", expect.objectContaining({ name: NINGBO.name, status: "Inactive" }));
    expect(toast.success).toHaveBeenCalledWith("Supplier saved");
  });

  it("reactivates an inactive supplier without asking", async () => {
    patch.mockResolvedValue(saved);
    const { user, field, save } = open("dialog=edit&id=s-7");
    expect(field("Status")).toHaveValue("Inactive");
    await user.selectOptions(field("Status"), "Active");
    await user.click(save);

    await waitFor(() => expect(patch).toHaveBeenCalledWith("/suppliers/s-7", expect.objectContaining({ status: "Active" })));
    expect(screen.queryByRole("dialog", { name: /Deactivate/ })).not.toBeInTheDocument();
  });

  it("shows M22 under Supplier name for a rename to a taken name, after the confirmation too", async () => {
    patch.mockRejectedValue(new ApiError(409, "name_exists", M22, { name: M22 }));
    const { user, field, save } = open(EDIT);
    await user.clear(field("Supplier name"));
    await user.type(field("Supplier name"), "Wenzhou Buttons");
    await user.selectOptions(field("Status"), "Inactive");
    await user.click(save);
    await user.click(await screen.findByRole("button", { name: "Deactivate" }));

    expect(await screen.findByText(M22)).toBeVisible();
    expect(screen.queryByRole("dialog", { name: /Deactivate/ })).not.toBeInTheDocument();
    expect(field("Supplier name")).toHaveValue("Wenzhou Buttons");
    expect(field("Supplier name")).toHaveAttribute("aria-invalid", "true");
    expect(toast.success).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
