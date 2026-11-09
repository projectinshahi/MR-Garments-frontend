import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { OrderOptions } from "@/lib/api/types";

import { NewOrderScreen } from "./new-order-screen";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn() } }));
const post = vi.mocked(apiClient.post);

const TODAY = "2026-10-27";
const options: OrderOptions = {
  nextPo: "PO-2050",
  suppliers: [
    { id: "s-foshan", name: "Foshan Fabrics", contactPerson: "Mr. Li Wei", phone: "+86 757 8812 0345", city: "Foshan, China", currency: "CNY" },
    { id: "s-yiwu", name: "Yiwu Trims Ltd.", contactPerson: "Ms. Zhao", phone: "+86 579 0000", city: "Yiwu", currency: "USD" },
    { id: "s-kochi", name: "Kochi Mills", contactPerson: "", phone: "", city: "Kochi", currency: "INR" },
  ],
  items: [
    { id: "i-denim", name: "Cotton denim fabric", unit: "m", price: null },
    { id: "i-buttons", name: "Metal buttons", unit: "pcs", price: null },
    // The one item with a saved price: New order fills its rate from it.
    { id: "i-zips", name: "Zips", unit: "pcs", price: 0.75 },
  ],
  agents: [{ id: "a-sino", name: "Sino Freight" }],
};

function open() {
  const user = userEvent.setup({ delay: null });
  render(<NewOrderScreen data={{ options, today: TODAY }} />);
  // Prefix match: required labels are followed by the required mark.
  const field = (label: string) => screen.getByLabelText(new RegExp(`^${label.replace(/[()]/g, "\\$&")}`));
  const place = screen.getByRole("button", { name: "Place order" });
  return { user, field, place };
}

async function fillOrder({ user, field }: ReturnType<typeof open>) {
  await user.selectOptions(field("Supplier"), "s-foshan");
  await user.type(field("Delivery date"), "2026-11-25");
  await user.selectOptions(field("Item, line 1"), "i-denim");
  await user.type(field("Rate (¥), line 1"), "18.50");
  await user.type(field("Quantity, line 1"), "2,400");
}

beforeEach(() => vi.clearAllMocks());

describe("NewOrderScreen", () => {
  it("offers the next PO (editable), today as the order date, and fills the supplier's contact on selection", async () => {
    const ui = open();
    expect(ui.field("Purchase order no.")).toHaveValue("PO-2050");
    expect(ui.field("Purchase order no.")).not.toHaveAttribute("readonly");
    expect(ui.field("Order date")).toHaveValue(TODAY);
    expect(ui.field("Contact person")).toHaveValue("");

    await ui.user.selectOptions(ui.field("Supplier"), "s-foshan");
    expect(ui.field("Contact person")).toHaveValue("Mr. Li Wei");
    expect(ui.field("Phone")).toHaveValue("+86 757 8812 0345");
    expect(ui.field("City")).toHaveValue("Foshan, China");
    expect(ui.field("City")).toHaveAttribute("readonly");
  });

  it("posts ORD-3 with lines and deposits, then toasts, empties the form and opens the new order", async () => {
    post.mockResolvedValue({ order: { id: "o-1", po: "PO-2050" } });
    const ui = open();
    await fillOrder(ui);
    expect(screen.getByText("m")).toBeVisible();
    expect(ui.field("Amount (¥), line 1")).toHaveValue("44,400.00");

    // A second line, and an empty third one that is ignored (the reference has no remove control).
    await ui.user.click(screen.getByRole("button", { name: "+ Add item" }));
    await ui.user.click(screen.getByRole("button", { name: "+ Add item" }));
    await ui.user.selectOptions(ui.field("Item, line 2"), "i-buttons");
    await ui.user.type(ui.field("Rate (¥), line 2"), "0.35");
    await ui.user.type(ui.field("Quantity, line 2"), "10000");

    await ui.user.click(screen.getByRole("button", { name: "+ Add deposit" }));
    await ui.user.type(ui.field("Amount (¥), deposit 1"), "20000");
    await ui.user.type(screen.getAllByLabelText("Rate to INR")[0]!, "11.6");
    await ui.user.type(screen.getAllByLabelText("Mode")[0]!, "Bank transfer");
    await ui.user.click(screen.getByRole("button", { name: "+ Add deposit" }));
    await ui.user.selectOptions(ui.field("Paid to, deposit 2"), "a-sino");
    await ui.user.type(ui.field("Amount (¥), deposit 2"), "1500");
    await ui.user.type(screen.getAllByLabelText("Rate to INR")[1]!, "11.6");
    await ui.user.type(screen.getAllByLabelText("Mode")[1]!, "Bank transfer");
    expect(screen.getByRole("status", { name: "Order total" })).toHaveTextContent("¥ 47,900.00");
    await ui.user.type(ui.field("Deposit required (¥)"), "25,000");

    await ui.user.click(ui.place);

    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledWith("/orders", {
      po: "PO-2050",
      supplierId: "s-foshan",
      currency: "CNY",
      orderDate: TODAY,
      deliveryDate: "2026-11-25",
      depositRequiredCny: 25000,
      lines: [
        { itemId: "i-denim", quantity: 2400, rateCny: 18.5 },
        { itemId: "i-buttons", quantity: 10000, rateCny: 0.35 },
      ],
      deposits: [
        { payee: "Foshan Fabrics", payeeRole: "supplier", amountCny: 20000, paidOn: TODAY, rateInr: 11.6, mode: "Bank transfer" },
        { payee: "Sino Freight", payeeRole: "agent", amountCny: 1500, paidOn: TODAY, rateInr: 11.6, mode: "Bank transfer" },
      ],
    });
    expect(toast.success).toHaveBeenCalledWith("Order PO-2050 placed");
    expect(router.push).toHaveBeenCalledWith("/orders/PO-2050");
    expect(router.push.mock.invocationCallOrder[0]).toBeLessThan(router.refresh.mock.invocationCallOrder[0]!);
    // The route stays mounted, so the next visit must not show this order again.
    expect(ui.field("Supplier")).toHaveValue("");
    expect(ui.field("Delivery date")).toHaveValue("");
    expect(ui.field("Deposit required (¥)")).toHaveValue("");
    expect(screen.queryByLabelText(/^Item, line 2/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Amount \(¥\), deposit 1/)).not.toBeInTheDocument();
  }, 30_000);

  it("sends one request however often Place order is clicked while it runs", async () => {
    let answer: (value: unknown) => void = () => {};
    post.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const ui = open();
    await fillOrder(ui);
    await ui.user.click(ui.place);
    await waitFor(() => expect(ui.place).toBeDisabled());
    await ui.user.click(ui.place);
    expect(post).toHaveBeenCalledOnce();
    answer({ order: { id: "o-1", po: "PO-2050" } });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/orders/PO-2050"));
  });

  it("sends the PO number the user typed in any format, refusing a blank one itself, and shows a 422 'already used' under it", async () => {
    const taken = "This PO number is already used by another order.";
    post.mockRejectedValueOnce(new ApiError(422, "validation_failed", "Some fields need attention.", { po: taken }));
    post.mockResolvedValueOnce({ order: { id: "o-4", po: "MR/2026/001" } });
    const ui = open();
    await fillOrder(ui);
    await ui.user.clear(ui.field("Purchase order no."));
    await ui.user.click(ui.place);
    expect(await screen.findByText("Enter the PO number.")).toBeVisible();
    expect(post).not.toHaveBeenCalled();

    // Trimmed, otherwise as typed: no PO- prefix or letter case is forced.
    await ui.user.type(ui.field("Purchase order no."), " mr/2026/001 ");
    await ui.user.click(ui.place);
    expect(await screen.findByText(taken)).toBeVisible();
    expect(ui.field("Purchase order no.")).toHaveAttribute("aria-invalid", "true");
    expect(post).toHaveBeenCalledWith("/orders", expect.objectContaining({ po: "mr/2026/001" }));
    expect(router.push).not.toHaveBeenCalled();

    // Placed again (say, after the other order was renumbered): the server's PO names the toast and, encoded, the page.
    await ui.user.click(ui.place);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/orders/MR%2F2026%2F001"));
    expect(toast.success).toHaveBeenCalledWith("Order MR/2026/001 placed");
  }, 30_000);

  it("shows a 422 field error under its field and keeps the values", async () => {
    const message = "The delivery date can't be before the order date.";
    post.mockRejectedValue(new ApiError(422, "validation_failed", "Check the highlighted fields.", { deliveryDate: message }));
    const ui = open();
    await fillOrder(ui);
    await ui.user.click(ui.place);

    expect(await screen.findByText(message)).toBeVisible();
    expect(ui.field("Delivery date")).toHaveAttribute("aria-invalid", "true");
    expect(ui.field("Delivery date")).toHaveValue("2026-11-25");
    expect(toast.success).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("fills the rate from the item's saved price, which stays editable, and clears it for an item without one", async () => {
    const ui = open();
    await ui.user.selectOptions(ui.field("Item, line 1"), "i-zips");
    expect(ui.field("Rate (¥), line 1")).toHaveValue("0.75");
    await ui.user.type(ui.field("Quantity, line 1"), "1,000");
    expect(ui.field("Amount (¥), line 1")).toHaveValue("750.00");
    // The user may still type another rate; the totals follow.
    await ui.user.clear(ui.field("Rate (¥), line 1"));
    await ui.user.type(ui.field("Rate (¥), line 1"), "0.8");
    expect(ui.field("Amount (¥), line 1")).toHaveValue("800.00");
    // An item without a price never keeps the previous item's rate.
    await ui.user.selectOptions(ui.field("Item, line 1"), "i-denim");
    expect(ui.field("Rate (¥), line 1")).toHaveValue("");
    expect(ui.field("Amount (¥), line 1")).toHaveValue("");
    await ui.user.selectOptions(ui.field("Item, line 1"), "i-zips");
    expect(ui.field("Rate (¥), line 1")).toHaveValue("0.75");
  });

  it("checks the form before calling the API", async () => {
    const ui = open();
    await ui.user.click(ui.place);

    expect(await screen.findByText("Choose a supplier.")).toBeVisible();
    expect(screen.getByText("Choose the delivery date.")).toBeVisible();
    expect(screen.getByText("Add at least one item.")).toBeVisible();

    await ui.user.selectOptions(ui.field("Item, line 1"), "i-denim");
    await ui.user.click(ui.place);
    expect(await screen.findByText("Line 1: Enter the rate.")).toBeVisible();
    expect(post).not.toHaveBeenCalled();
  });

  it("the deposit required is optional, checked before the API, and follows the currency", async () => {
    post.mockResolvedValue({ order: { id: "o-5", po: "PO-2050" } });
    const ui = open();
    await fillOrder(ui);
    expect(ui.field("Deposit required (¥)")).toHaveValue("");
    await ui.user.type(ui.field("Deposit required (¥)"), "1.234");
    await ui.user.click(ui.place);
    expect(await screen.findByText("Enter the deposit the supplier asked for: above 0, with at most 2 decimals.")).toBeVisible();
    expect(ui.field("Deposit required (¥)")).toHaveAttribute("aria-invalid", "true");
    expect(post).not.toHaveBeenCalled();

    await ui.user.clear(ui.field("Deposit required (¥)"));
    await ui.user.click(ui.place);
    await waitFor(() => expect(post).toHaveBeenCalledOnce());
    expect(post.mock.calls[0]![1]).not.toHaveProperty("depositRequiredCny");

    await ui.user.selectOptions(ui.field("Currency"), "USD");
    expect(screen.getByLabelText("Deposit required ($)")).toBeVisible();
  });

  it("shows a 422 on the items under the table, and toasts a field the form doesn't show", async () => {
    post.mockRejectedValue(
      new ApiError(422, "validation_failed", "Some fields need attention.", { lines: "Choose an item from the list.", stage: "Only CNY." }),
    );
    const ui = open();
    await fillOrder(ui);
    await ui.user.click(ui.place);

    expect(await screen.findByText("Choose an item from the list.")).toBeVisible();
    expect(toast.error).toHaveBeenCalledWith("Only CNY.");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("takes the supplier's currency, which the user may change: labels and totals follow it", async () => {
    post.mockResolvedValue({ order: { id: "o-2", po: "PO-2050" } });
    const ui = open();
    expect(ui.field("Currency")).toHaveValue("CNY");
    expect([...(ui.field("Currency") as HTMLSelectElement).options].map((option) => option.text)).toEqual(["CNY (¥)", "USD ($)", "INR (₹)"]);
    await ui.user.selectOptions(ui.field("Supplier"), "s-yiwu");
    expect(ui.field("Currency")).toHaveValue("USD");
    await ui.user.type(ui.field("Delivery date"), "2026-11-25");
    await ui.user.selectOptions(ui.field("Item, line 1"), "i-buttons");
    await ui.user.type(screen.getByLabelText("Rate ($), line 1"), "0.35");
    await ui.user.type(ui.field("Quantity, line 1"), "1000");
    expect(screen.getByRole("status", { name: "Order total" })).toHaveTextContent("$ 350.00");
    await ui.user.click(screen.getByRole("button", { name: "+ Add deposit" }));
    await ui.user.type(screen.getByLabelText("Amount ($), deposit 1"), "100");
    await ui.user.type(ui.field("Mode"), "Wire");
    await ui.user.click(ui.place);
    expect(await screen.findByText("Deposit 1: Enter the rate.")).toBeVisible();
    await ui.user.type(ui.field("Rate to INR"), "88.5");
    expect(screen.getAllByText("₹8,850")).toHaveLength(2); // the deposit and "Deposits in INR"
    await ui.user.click(ui.place);
    await waitFor(() => expect(post).toHaveBeenCalledOnce());
    expect(post.mock.calls[0]![1]).toMatchObject({
      supplierId: "s-yiwu",
      currency: "USD",
      deposits: [{ payee: "Yiwu Trims Ltd.", amountCny: 100, rateInr: 88.5, mode: "Wire" }],
    });
  }, 30_000);

  it("an INR order asks no deposit rate and sends none", async () => {
    post.mockResolvedValue({ order: { id: "o-3", po: "PO-2050" } });
    const ui = open();
    await ui.user.selectOptions(ui.field("Supplier"), "s-foshan");
    await ui.user.selectOptions(ui.field("Currency"), "INR");
    await ui.user.type(ui.field("Delivery date"), "2026-11-25");
    await ui.user.selectOptions(ui.field("Item, line 1"), "i-denim");
    await ui.user.type(ui.field("Rate (₹), line 1"), "250");
    await ui.user.type(ui.field("Quantity, line 1"), "10");
    await ui.user.click(screen.getByRole("button", { name: "+ Add deposit" }));
    expect(screen.queryByLabelText("Rate to INR")).not.toBeInTheDocument();
    await ui.user.type(ui.field("Amount (₹), deposit 1"), "1000");
    await ui.user.type(ui.field("Mode"), "NEFT");
    await ui.user.click(ui.place);
    await waitFor(() => expect(post).toHaveBeenCalledOnce());
    const body = post.mock.calls[0]![1] as { currency: string; deposits: object[] };
    expect(body.currency).toBe("INR");
    expect(body.deposits).toEqual([{ payee: "Foshan Fabrics", payeeRole: "supplier", amountCny: 1000, paidOn: TODAY, mode: "NEFT" }]);
  }, 30_000);

  it("has no Save draft stub", () => {
    open();
    expect(screen.queryByRole("button", { name: "Save draft" })).not.toBeInTheDocument();
  });
});
