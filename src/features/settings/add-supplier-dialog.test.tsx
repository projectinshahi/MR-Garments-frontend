import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { SupplierRow } from "@/lib/api/types";

import { AddSupplierDialog } from "./add-supplier-dialog";
import { supplierDraft } from "./data/fixtures";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams("dialog=add-supplier"),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn() } }));

const post = vi.mocked(apiClient.post);
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

function open() {
  const user = userEvent.setup();
  render(<AddSupplierDialog draft={supplierDraft} />);
  // Prefix match: "Supplier name" is followed by the required mark.
  const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`));
  const save = screen.getByRole("button", { name: "Save supplier" });
  return { user, field, save };
}

beforeEach(() => vi.clearAllMocks());

// The dialog opens empty (user decision, 2026-10-26), so each test types what it needs.
describe("AddSupplierDialog", () => {
  it("opens empty, with yuan selected", () => {
    const { field } = open();
    for (const label of ["Supplier name", "City", "Contact person", "Phone / WeChat", "Address", "Notes"]) {
      expect(field(label)).toHaveValue("");
    }
    expect(field("Currency")).toHaveValue("CNY");
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
