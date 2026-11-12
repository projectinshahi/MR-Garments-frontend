import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { SupplierRow } from "@/lib/api/types";

import { SupplierDialog } from "./add-supplier-dialog";
import { currencyFixture, supplierDraft } from "./data/fixtures";

const nav = vi.hoisted(() => ({ query: "dialog=add", router: { refresh: vi.fn() } }));
const router = nav.router;
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/suppliers",
  useRouter: () => nav.router,
  useSearchParams: () => new URLSearchParams(nav.query),
}));
const replaceState = vi.spyOn(window.history, "replaceState");
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
// The rate (INR per 1 CNY) as the form takes it and as the body carries it (docs/supplier-currency.md).
const RATE = "11.5";
const CURRENCY = "Preferred transaction currency";
// The profile fields (backend docs/suppliers.md) of the saved row; the Add form posts them empty unless typed.
const PROFILE = { code: "SUP-006", country: "China", email: "xu.feng@ningbo-denim.cn", state: "Zhejiang", postalCode: "315000", paymentTerms: "30% deposit", taxNumber: "91330200MA" };
const EMPTY_PROFILE = { country: "", email: "", state: "", postalCode: "", paymentTerms: "", taxNumber: "" };
const saved: { supplier: SupplierRow } = { supplier: { ...NINGBO, ...PROFILE, id: "s-6", openOrders: 0, openPos: 0, ytdValue: [], balance: [], exchangeRate: 11.5, rateUpdatedAt: "2026-11-01T06:30:00.000Z", hasTransactions: false, status: "Active" } };
const ROWS: SupplierRow[] = [
  saved.supplier,
  { ...saved.supplier, id: "s-7", code: "SUP-007", name: "Wenzhou Buttons", status: "Inactive" },
  // Has orders or deposits: a new currency or rate asks first (the code is outside SUP-nnn, so the next code stays SUP-008).
  { ...saved.supplier, id: "s-8", code: "HZ-01", name: "Hangzhou Knits", hasTransactions: true },
];

function open(query = "dialog=add") {
  nav.query = query;
  const user = userEvent.setup();
  render(<SupplierDialog draft={supplierDraft} suppliers={ROWS} currencies={currencyFixture} />);
  // Prefix match: "Supplier name" is followed by the required mark.
  const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`));
  const save = screen.getByRole("button", { name: "Save supplier" });
  /** Picks a currency in the searchable picker by typing its code. */
  const pickCurrency = async (code: string) => {
    await user.click(field(CURRENCY));
    await user.type(screen.getByRole("searchbox", { name: "Search currencies" }), code);
    await user.click(screen.getByRole("option", { name: new RegExp(`^${code}`) }));
  };
  return { user, field, save, pickCurrency };
}

beforeEach(() => vi.clearAllMocks());

// The dialog opens empty (user decision, 2026-10-26), so each test types what it needs.
describe("Add supplier", () => {
  it("opens empty but for the next code, with yuan selected and no Status", () => {
    const { field } = open();
    expect(screen.getByRole("dialog", { name: "Add supplier" })).toBeVisible();
    for (const label of ["Supplier name", "City", "State / Province", "Postal code", "Contact person", "Email", "Phone", "Address", "Payment terms", "Tax / registration number", "Notes"]) {
      expect(field(label)).toHaveValue("");
    }
    // The highest SUP-nnn in the list (SUP-007) plus one.
    expect(field("Supplier code")).toHaveValue("SUP-008");
    expect(field("Country")).toHaveValue("");
    expect(field(CURRENCY)).toHaveTextContent("CNY – Chinese Yuan (¥)");
    expect(field("Exchange rate")).toHaveValue("");
    expect(field("Exchange rate")).toHaveAccessibleName("Exchange rate (1 CNY = ? INR)");
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
  });

  it("posts MD-2 with every field, then toasts, closes and reloads the list (K7)", async () => {
    post.mockResolvedValue(saved);
    const { user, field, save } = open();
    await user.type(field("Supplier name"), NINGBO.name);
    await user.type(field("City"), NINGBO.city);
    await user.type(field("Contact person"), NINGBO.contactPerson);
    await user.type(field("Phone"), NINGBO.phone);
    await user.type(field("Address"), NINGBO.address);
    await user.type(field("Notes"), NINGBO.notes);
    await user.type(field("Exchange rate"), RATE);
    expect(screen.getByText("1 CNY = ₹11.50")).toBeVisible();
    await user.click(save);

    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledWith("/suppliers", { ...NINGBO, ...EMPTY_PROFILE, code: "SUP-008", exchangeRate: 11.5 });
    expect(toast.success).toHaveBeenCalledWith("Supplier added");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/settings/suppliers");
    expect(replaceState.mock.invocationCallOrder[0]).toBeLessThan(router.refresh.mock.invocationCallOrder[0]!);
  });

  it("disables Save while the request runs (E14)", async () => {
    let finish: (value: typeof saved) => void = () => {};
    post.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { user, field, save } = open();
    await user.type(field("Supplier name"), NINGBO.name);
    await user.type(field("Exchange rate"), RATE);
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
    await user.type(field("Exchange rate"), RATE);
    await user.click(save);

    expect(await screen.findByText(M22)).toBeVisible();
    expect(field("Supplier name")).toHaveValue("ningbo denim works");
    expect(field("Supplier name")).toHaveFocus();
    expect(field("Supplier name")).toHaveAttribute("aria-invalid", "true");
    expect(field("City")).toHaveValue("Ningbo");
    expect(save).toBeEnabled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("shows M21 without calling the API when the name is empty (E1)", async () => {
    const { user, field, save } = open();
    await user.click(save);

    expect(await screen.findByText("Enter the supplier name.")).toBeVisible();
    expect(field("Supplier name")).toHaveFocus();
    expect(post).not.toHaveBeenCalled();
  });

  it("checks the code, email and phone shapes without calling the API, and shows a taken code under Supplier code", async () => {
    const { user, field, save } = open();
    await user.type(field("Supplier name"), NINGBO.name);
    await user.clear(field("Supplier code"));
    await user.type(field("Email"), "nope");
    await user.type(field("Phone"), "call me");
    await user.type(field("Exchange rate"), "0");
    await user.click(save);
    expect(await screen.findByText("Use up to 20 letters, digits or dashes.")).toBeVisible();
    expect(screen.getByText("Enter a valid email address.")).toBeVisible();
    expect(screen.getByText("Enter a valid phone number.")).toBeVisible();
    expect(screen.getByText("Enter the exchange rate: INR per 1 unit, above 0, with at most 4 decimals.")).toBeVisible();
    expect(post).not.toHaveBeenCalled();
    await user.clear(field("Exchange rate"));
    await user.type(field("Exchange rate"), RATE);

    const CODE_TAKEN = "A supplier with this code already exists.";
    post.mockRejectedValue(new ApiError(409, "code_exists", CODE_TAKEN, { code: CODE_TAKEN }));
    await user.type(field("Supplier code"), "sup-007");
    await user.clear(field("Email"));
    await user.clear(field("Phone"));
    await user.click(save);
    expect(await screen.findByText(CODE_TAKEN)).toBeVisible();
    // Posted upper-case, as the API stores it.
    expect(post).toHaveBeenCalledWith("/suppliers", expect.objectContaining({ code: "SUP-007" }));
    expect(field("Supplier code")).toHaveFocus();
  });

  it("toasts M24 and keeps the dialog and values when the request fails (E12)", async () => {
    post.mockRejectedValue(new ApiError(0, "network_error", "Something went wrong."));
    const { user, field, save } = open();
    await user.type(field("Supplier name"), NINGBO.name);
    await user.type(field("Exchange rate"), RATE);
    await user.click(save);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something went wrong.", { description: "Please try again." }));
    expect(screen.getByRole("dialog", { name: "Add supplier" })).toBeVisible();
    expect(field("Supplier name")).toHaveValue("Ningbo Denim Works");
    expect(save).toBeEnabled();
    expect(replaceState).not.toHaveBeenCalled();
  });
});

describe("Edit supplier", () => {
  const EDIT = "dialog=edit&id=s-6";

  it("opens the Add form filled from the row, plus Status", () => {
    const { field, save } = open(EDIT);
    expect(screen.getByRole("dialog", { name: "Edit supplier" })).toBeVisible();
    expect(field("Supplier code")).toHaveValue(PROFILE.code);
    expect(field("Supplier name")).toHaveValue(NINGBO.name);
    expect(field("Country")).toHaveValue(PROFILE.country);
    expect(field("City")).toHaveValue(NINGBO.city);
    expect(field("State / Province")).toHaveValue(PROFILE.state);
    expect(field("Postal code")).toHaveValue(PROFILE.postalCode);
    expect(field("Contact person")).toHaveValue(NINGBO.contactPerson);
    expect(field("Email")).toHaveValue(PROFILE.email);
    expect(field("Phone")).toHaveValue(NINGBO.phone);
    expect(field("Payment terms")).toHaveValue(PROFILE.paymentTerms);
    expect(field("Tax / registration number")).toHaveValue(PROFILE.taxNumber);
    expect(field(CURRENCY)).toHaveTextContent("CNY – Chinese Yuan (¥)");
    expect(field("Exchange rate")).toHaveValue("11.5");
    expect(field("Address")).toHaveValue(NINGBO.address);
    expect(field("Notes")).toHaveValue(NINGBO.notes);
    expect(field("Status")).toHaveValue("Active");
    expect(save).toBeEnabled();
  });

  it("opens nothing for an id that isn't in the list", () => {
    nav.query = "dialog=edit&id=s-404";
    render(<SupplierDialog draft={supplierDraft} suppliers={ROWS} currencies={currencyFixture} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("patches the editable fields, the currency and status, then toasts Supplier saved, closes and reloads", async () => {
    patch.mockResolvedValue(saved);
    const { user, field, save, pickCurrency } = open(EDIT);
    await user.clear(field("City"));
    await user.type(field("City"), " Shanghai ");
    await pickCurrency("USD");
    expect(field(CURRENCY)).toHaveTextContent("USD – US Dollar ($)");
    // Another currency starts with an empty rate (the yuan rate means nothing for dollars) and asks for one.
    expect(field("Exchange rate")).toHaveValue("");
    expect(field("Exchange rate")).toHaveAccessibleName("Exchange rate (1 USD = ? INR)");
    await user.type(field("Exchange rate"), "88");
    await user.click(save);

    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/suppliers/s-6", { ...NINGBO, ...PROFILE, city: "Shanghai", currency: "USD", exchangeRate: 88, status: "Active" });
    expect(post).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Supplier saved");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/settings/suppliers");
  });

  it("asks before deactivating; Cancel keeps the dialog and saves nothing", async () => {
    const { user, field, save } = open(EDIT);
    await user.selectOptions(field("Status"), "Inactive");
    await user.click(save);

    const confirm = await screen.findByRole("alertdialog", { name: "Deactivate supplier?" });
    expect(confirm).toHaveTextContent("Are you sure you want to deactivate Ningbo Denim Works?");
    expect(confirm).toHaveTextContent("It won't appear when a new order is created.");
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog", { name: /^Deactivate/ })).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "Edit supplier" })).toBeVisible();
    expect(field("Status")).toHaveValue("Inactive");
    expect(patch).not.toHaveBeenCalled();
  });

  it("saves the deactivation once confirmed", async () => {
    patch.mockResolvedValue({ supplier: { ...saved.supplier, status: "Inactive" } });
    const { user, field, save } = open(EDIT);
    await user.selectOptions(field("Status"), "Inactive");
    await user.click(save);
    await user.click(await screen.findByRole("button", { name: "Deactivate supplier" }));

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
    expect(screen.queryByRole("alertdialog", { name: /^Deactivate/ })).not.toBeInTheDocument();
  });

  it("shows M22 under Supplier name for a rename to a taken name, after the confirmation too", async () => {
    patch.mockRejectedValue(new ApiError(409, "name_exists", M22, { name: M22 }));
    const { user, field, save } = open(EDIT);
    await user.clear(field("Supplier name"));
    await user.type(field("Supplier name"), "Wenzhou Buttons");
    await user.selectOptions(field("Status"), "Inactive");
    await user.click(save);
    await user.click(await screen.findByRole("button", { name: "Deactivate supplier" }));

    expect(await screen.findByText(M22)).toBeVisible();
    expect(screen.queryByRole("alertdialog", { name: /^Deactivate/ })).not.toBeInTheDocument();
    expect(field("Supplier name")).toHaveValue("Wenzhou Buttons");
    expect(field("Supplier name")).toHaveAttribute("aria-invalid", "true");
    expect(toast.success).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });
});

describe("Currency and exchange rate (docs/supplier-currency.md)", () => {
  it("INR fixes the rate at 1, read-only, and posts it as 1", async () => {
    post.mockResolvedValue(saved);
    const { user, field, save, pickCurrency } = open();
    await user.type(field("Supplier name"), "Kochi Mills");
    await pickCurrency("INR");
    expect(field("Exchange rate")).toHaveValue("1");
    expect(field("Exchange rate")).toHaveAttribute("readonly");
    expect(screen.getByText("INR is the base currency: the rate is fixed at 1.")).toBeVisible();
    await user.click(save);
    await waitFor(() => expect(post).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledWith("/suppliers", expect.objectContaining({ currency: "INR", exchangeRate: 1 }));
  });

  it("finds any currency of the master by name, code or symbol; the rate label and body follow it", async () => {
    post.mockResolvedValue(saved);
    const { user, field, save } = open();
    await user.type(field("Supplier name"), "Gulf Fabrics");
    await user.click(field(CURRENCY));
    const search = screen.getByRole("searchbox", { name: "Search currencies" });
    await user.type(search, "dirham");
    expect(screen.getAllByRole("option").map((option) => option.getAttribute("aria-label"))).toEqual(["AED – United Arab Emirates Dirham (AED)"]);
    await user.click(screen.getByRole("option", { name: /^AED/ }));
    expect(field(CURRENCY)).toHaveTextContent("AED – United Arab Emirates Dirham (AED)");
    expect(field("Exchange rate")).toHaveAccessibleName("Exchange rate (1 AED = ? INR)");
    expect(field("Exchange rate")).toHaveValue("");
    await user.type(field("Exchange rate"), "23.5");
    expect(screen.getByText("1 AED = ₹23.50")).toBeVisible();
    await user.click(save);
    await waitFor(() => expect(post).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledWith("/suppliers", expect.objectContaining({ currency: "AED", exchangeRate: 23.5 }));
  });

  it("asks before a new rate or currency on a supplier with orders or deposits: Cancel keeps the dialog, confirming saves", async () => {
    patch.mockResolvedValue(saved);
    const { user, field, save } = open("dialog=edit&id=s-8");
    await user.clear(field("Exchange rate"));
    await user.type(field("Exchange rate"), "12");
    await user.click(save);
    const confirm = await screen.findByRole("alertdialog", { name: "Change this supplier's currency or rate?" });
    expect(confirm).toHaveTextContent("Hangzhou Knits already has orders or deposits.");
    expect(confirm).toHaveTextContent("apply to new orders and deposits only");
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(patch).not.toHaveBeenCalled();
    expect(field("Exchange rate")).toHaveValue("12");

    await user.click(save);
    await user.click(await screen.findByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(patch).toHaveBeenCalledWith("/suppliers/s-8", expect.objectContaining({ currency: "CNY", exchangeRate: 12 }));
  });

  it("saves other edits on such a supplier without asking", async () => {
    patch.mockResolvedValue(saved);
    const { user, field, save } = open("dialog=edit&id=s-8");
    await user.type(field("Notes"), " more");
    await user.click(save);
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(patch).toHaveBeenCalledWith("/suppliers/s-8", expect.objectContaining({ exchangeRate: 11.5, notes: "Denim only more" }));
  });
});
