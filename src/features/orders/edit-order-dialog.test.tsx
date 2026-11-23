import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { OrderDetail } from "@/lib/api/types";

import { EditOrderDialog, type EditableOrder, type ItemOption } from "./edit-order-dialog";

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
const path = vi.hoisted(() => ({ current: "/orders/PO-2051/payments" }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => path.current }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { patch: vi.fn() } }));
const patch = vi.mocked(apiClient.patch);

const ITEMS: ItemOption[] = [
  { id: "i-1", name: "Denim jeans", unit: "pcs", price: null },
  { id: "i-2", name: "Cotton fabric", unit: "m", price: null },
];
const line = (id: string, item: { id: string; name: string }, quantity: number, rateCny: number): OrderDetail["lines"][number] => ({
  id,
  position: 0,
  item,
  unit: "pcs",
  quantity,
  rateCny,
  valueCny: quantity * rateCny, poValueCny: quantity * rateCny,
  received: 0,
  loaded: 0,
});
// Line 2's item (Silk scarves) has been deactivated since the order was placed: ORD-2 no longer lists it.
const ORDER: EditableOrder = {
  po: "PO-2051",
  stage: 1,
  orderDate: "2026-10-01",
  deliveryDate: "2026-11-15",
  currency: "CNY",
  depositRequiredCny: null,
  lines: [line("l-1", { id: "i-1", name: "Denim jeans" }, 100, 10), line("l-2", { id: "i-9", name: "Silk scarves" }, 50, 20)],
};
const LINES_ERROR = "Add at least one item.";
const DEPOSIT_MESSAGE = "Enter the deposit the supplier asked for: above 0, with at most 2 decimals.";

function open(order: EditableOrder = ORDER) {
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(<EditOrderDialog order={order} items={ITEMS} open onClose={onClose} />);
  const date = (label: RegExp) => screen.getByLabelText(label);
  const setDate = (label: RegExp, value: string) => fireEvent.change(date(label), { target: { value } });
  const box = (name: string) => screen.getByRole("textbox", { name });
  const save = screen.getByRole("button", { name: "Save order" });
  return { user, onClose, date, setDate, box, save };
}

beforeEach(() => vi.clearAllMocks());

describe("Edit order at stage 1", () => {
  it("sends the changed keys with the whole lines list (kept ids, added and removed lines), then toasts, closes and reloads", async () => {
    let finish: () => void = () => {};
    patch.mockReturnValue(new Promise((resolve) => (finish = () => resolve({}))));
    const { user, onClose, setDate, box, save } = open();
    expect(screen.getByRole("dialog", { name: "Edit order" })).toHaveTextContent("The supplier's account follows the goods received, never the PO value.");
    expect(screen.getByRole("status", { name: "PO value" })).toHaveTextContent("¥ 2,000.00");
    // No "paid to supplier" or advance footer any more; the value change shows once the lines change.
    expect(screen.queryByText(/Paid to supplier|Supplier advance/)).not.toBeInTheDocument();
    expect(screen.queryByText(/on the supplier's account/)).not.toBeInTheDocument();

    setDate(/^Delivery date/, "2026-11-20");
    await user.clear(box("Quantity, line 1"));
    await user.type(box("Quantity, line 1"), "120");
    await user.click(screen.getByRole("button", { name: "Remove line 2" }));
    await user.click(screen.getByRole("button", { name: "+ Add item" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Item, line 2" }), "Cotton fabric");
    await user.type(box("Rate (¥), line 2"), "8");
    await user.type(box("Quantity, line 2"), "500");
    expect(screen.getByRole("status", { name: "PO value" })).toHaveTextContent("¥ 5,200.00");
    expect(screen.getByText(/on the supplier's account/)).toHaveTextContent("Was ¥ 2,000.00 · no change on the supplier's account until goods are received");

    await user.click(save);
    expect(await screen.findByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(patch).toHaveBeenCalledOnce();
    expect(patch).toHaveBeenCalledWith("/orders/PO-2051", {
      deliveryDate: "2026-11-20",
      lines: [
        { id: "l-1", itemId: "i-1", quantity: 120, rateCny: 10 },
        { itemId: "i-2", quantity: 500, rateCny: 8 },
      ],
    });
    finish();
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(toast.success).toHaveBeenCalledWith("Order saved");
    expect(onClose).toHaveBeenCalledOnce();
    // Much typing: as New order's longest test, room for a busy machine.
  }, 30_000);

  it("keeps showing a line's inactive item, and leaves untouched lines out of the body", async () => {
    patch.mockResolvedValue({});
    const { user, setDate, save } = open();
    expect(screen.getByRole("combobox", { name: "Item, line 2" })).toHaveDisplayValue("Silk scarves");
    setDate(/^Order date/, "2026-09-28");
    await user.click(save);
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/orders/PO-2051", { orderDate: "2026-09-28" }));
  });

  it("no longer refuses a total below what's paid (D9): a lower total is sent, and the API's ledger change is toasted", async () => {
    patch.mockResolvedValue({ order: { po: "PO-2051" }, ledger: { supplierId: "s1", currency: "CNY", changeCny: -1990, balanceBefore: -2000, balanceAfter: -10 } });
    const { user, box, save } = open();
    await user.click(screen.getByRole("button", { name: "Remove line 2" }));
    expect(screen.getByRole("button", { name: "Remove line 1" })).toBeDisabled();
    await user.clear(box("Quantity, line 1"));
    await user.type(box("Quantity, line 1"), "1");
    expect(screen.getByText(/on the supplier's account/)).toHaveTextContent("no change on the supplier's account until goods are received");
    await user.click(save);
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/orders/PO-2051", { lines: [{ id: "l-1", itemId: "i-1", quantity: 1, rateCny: 10 }] }));
    expect(toast.success).toHaveBeenCalledWith("Order saved. Supplier balance: Payable to supplier ¥2,000.00 → Payable to supplier ¥10.00");
  });

  it("warns on a held supplier account and toasts the API's 409 and the 503 maintenance message", async () => {
    const { user, setDate, save } = open({ ...ORDER, held: true });
    expect(screen.getByText(/This supplier's account is pending review\./)).toBeVisible();
    patch.mockRejectedValueOnce(new ApiError(409, "account_held", "This supplier's account is pending review."));
    setDate(/^Delivery date/, "2026-11-20");
    await user.click(save);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("This supplier's account is pending review."));
    patch.mockRejectedValueOnce(new ApiError(503, "ledger_maintenance", "Paused."));
    await user.click(save);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Paused for maintenance", { description: "Paused." }));
  });

  it("shows the API's field errors under their fields, the lines one under the table, and stays open", async () => {
    const before = "The delivery date can't be before the order date.";
    patch.mockRejectedValue(new ApiError(422, "validation_failed", "Check the highlighted fields.", { deliveryDate: before, lines: LINES_ERROR }));
    const { user, onClose, setDate, save } = open();
    setDate(/^Delivery date/, "2026-11-20");
    await user.click(save);
    expect(await screen.findByText(before)).toBeVisible();
    expect(screen.getByText(LINES_ERROR)).toBeVisible();
    expect(toast.error).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("a 409 without fields toasts the API's message and keeps the dialog and its values", async () => {
    const locked = "Goods have been received for this order, so its order date and items can't change.";
    patch.mockRejectedValue(new ApiError(409, "order_locked", locked));
    const { user, onClose, date, setDate, save } = open();
    setDate(/^Delivery date/, "2026-11-20");
    await user.click(save);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(locked));
    expect(onClose).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
    expect(date(/^Delivery date/)).toHaveValue("2026-11-20");
    expect(save).toBeEnabled();
  });
});

describe("Money in the order's currency (phase 2 final fixes, 5)", () => {
  it("labels the deposit required, the rates, the amounts, the total and the value change in the order's currency, keeping the saved requirement", async () => {
    const { user, box } = open({ ...ORDER, currency: "USD", depositRequiredCny: 1500.5 });
    expect(box("Deposit required ($)")).toHaveValue("1500.5");
    expect(screen.getByRole("columnheader", { name: "Rate ($)" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Amount ($)" })).toBeInTheDocument();
    expect(screen.getByText("$ 2,000.00")).toBeVisible();
    expect(screen.queryByText(/¥/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove line 2" }));
    expect(screen.getByText(/on the supplier's account/)).toHaveTextContent("Was $ 2,000.00 · no change on the supplier's account until goods are received");
  });

  it("still opens when an older API left the requirement out, and a no-change save sends nothing", async () => {
    const { user, onClose, save } = open({ ...ORDER, depositRequiredCny: undefined as unknown as null });
    expect(screen.getByRole("textbox", { name: "Deposit required (¥)" })).toHaveValue("");
    // The missing requirement is "none": an untouched field must not become `depositRequiredCny: null` in the body
    // (an older ORD-5 rejects the key), so saving unchanged just closes.
    await user.click(save);
    expect(patch).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Deposit required (0009)", () => {
  it("is blank without a requirement and sends the amount only when set", async () => {
    patch.mockResolvedValue({});
    const { user, box, save } = open();
    expect(box("Deposit required (¥)")).toHaveValue("");
    await user.type(box("Deposit required (¥)"), "1.234");
    await user.click(save);
    expect(await screen.findByText(DEPOSIT_MESSAGE)).toBeVisible();
    expect(patch).not.toHaveBeenCalled();

    await user.clear(box("Deposit required (¥)"));
    await user.type(box("Deposit required (¥)"), "2,500.50");
    await user.click(save);
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/orders/PO-2051", { depositRequiredCny: 2500.5 }));
  });

  it("is prefilled from the order, left out of the body when unchanged, and cleared with null", async () => {
    patch.mockResolvedValue({});
    const { user, box, setDate, save } = open({ ...ORDER, depositRequiredCny: 500 });
    expect(box("Deposit required (¥)")).toHaveValue("500");
    setDate(/^Delivery date/, "2026-11-20");
    await user.click(save);
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/orders/PO-2051", { deliveryDate: "2026-11-20" }));

    await user.clear(box("Deposit required (¥)"));
    await user.click(save);
    await waitFor(() => expect(patch).toHaveBeenLastCalledWith("/orders/PO-2051", { deliveryDate: "2026-11-20", depositRequiredCny: null }));
  });

  it("shows the API's 422 under the field", async () => {
    patch.mockRejectedValue(new ApiError(422, "validation_failed", "Check the highlighted fields.", { depositRequiredCny: DEPOSIT_MESSAGE }));
    const { user, box, save } = open();
    await user.type(box("Deposit required (¥)"), "10");
    await user.click(save);
    expect(await screen.findByText(DEPOSIT_MESSAGE)).toBeVisible();
    expect(box("Deposit required (¥)")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("Edit order at stages 2-5", () => {
  it("shows only the delivery date and the deposit required as editable and sends only those", async () => {
    patch.mockResolvedValue({});
    const { user, date, setDate, box, save } = open({ ...ORDER, stage: 2 });
    expect(screen.getByRole("dialog", { name: "Edit order" })).toHaveTextContent(
      "Goods have been received for this order, so only the PO number, the delivery date and the deposit required can change.",
    );
    expect(date(/^Order date/)).toHaveAttribute("readonly");
    expect(screen.getByText("Silk scarves")).toBeVisible();
    // Not loaded yet at stage 2: the container terms are the one choice left (no item selects).
    expect(screen.getAllByRole("combobox")).toEqual([screen.getByRole("combobox", { name: "Container terms" })]);
    expect(screen.getAllByRole("textbox")).toEqual([box("PO number"), box("Deposit required (¥)")]);
    expect(screen.queryByRole("button", { name: "+ Add item" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Remove line/ })).toBeNull();

    setDate(/^Delivery date/, "2026-12-01");
    await user.type(box("Deposit required (¥)"), "300");
    await user.click(save);
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/orders/PO-2051", { deliveryDate: "2026-12-01", depositRequiredCny: 300 }));
  });
});

describe("PO number (ORD-5 po)", () => {
  const TAKEN = "This PO number is already used by another order.";

  it("is prefilled with the order's number and left out of the body when unchanged", async () => {
    patch.mockResolvedValue({ order: { id: "o-1", po: "PO-2051", stage: 1, orderDate: "2026-10-01", deliveryDate: "2026-11-20" } });
    const { user, setDate, box, save } = open();
    expect(box("PO number")).toHaveValue("PO-2051");
    expect(box("PO number")).toBeRequired();
    setDate(/^Delivery date/, "2026-11-20");
    await user.click(save);
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/orders/PO-2051", { deliveryDate: "2026-11-20" }));
    expect(toast.success).toHaveBeenCalledWith("Order saved");
    expect(router.refresh).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("sends a new number (trimmed), then opens the same tab at the order's new address with the new number", async () => {
    path.current = "/orders/PO-2051/payments";
    patch.mockResolvedValue({ order: { id: "o-1", po: "MR/2026/001", stage: 1, orderDate: "2026-10-01", deliveryDate: "2026-11-15" } });
    const { user, onClose, box, save } = open();
    await user.clear(box("PO number"));
    await user.type(box("PO number"), "  MR/2026/001 ");
    await user.click(save);
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/orders/PO-2051", { po: "MR/2026/001" }));
    expect(onClose).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Order saved. Its PO number is now MR/2026/001.");
    expect(router.replace).toHaveBeenCalledWith("/orders/MR%2F2026%2F001/payments");
  });

  it("works from the order's overview (no tab) and at stages 2-5", async () => {
    path.current = "/orders/PO-2051";
    patch.mockResolvedValue({ order: { id: "o-1", po: "PO-9001", stage: 3, orderDate: "2026-10-01", deliveryDate: "2026-11-15" } });
    const { user, box, save } = open({ ...ORDER, stage: 3 });
    await user.clear(box("PO number"));
    await user.type(box("PO number"), "PO-9001");
    await user.click(save);
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/orders/PO-2051", { po: "PO-9001" }));
    expect(router.replace).toHaveBeenCalledWith("/orders/PO-9001");
  });

  it("refuses an empty number before calling the API", async () => {
    const { user, box, save } = open();
    await user.clear(box("PO number"));
    await user.type(box("PO number"), "   ");
    await user.click(save);
    expect(await screen.findByText("Enter the PO number.")).toBeVisible();
    expect(box("PO number")).toHaveAttribute("aria-invalid", "true");
    expect(patch).not.toHaveBeenCalled();
  });

  it("shows the API's duplicate message under the field, focused, and keeps the dialog and the typed number", async () => {
    patch.mockRejectedValue(new ApiError(422, "validation_failed", "Some fields need attention.", { po: TAKEN }));
    const { user, onClose, box, save } = open();
    await user.clear(box("PO number"));
    await user.type(box("PO number"), "PO-2050");
    await user.click(save);
    expect(await screen.findByText(TAKEN)).toBeVisible();
    expect(box("PO number")).toHaveFocus();
    expect(box("PO number")).toHaveValue("PO-2050");
    expect(toast.error).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("Container terms (backend docs/order-container-terms.md)", () => {
  const terms = () => screen.getByRole("combobox", { name: "Container terms" });

  it("shows the saved terms, sends new ones, and leaves unchanged ones out", async () => {
    patch.mockResolvedValue({ order: { id: "o-1", po: "PO-2051", stage: 1, orderDate: "2026-10-01", deliveryDate: "2026-11-15", terms: "CNF" } });
    const { user, save } = open({ ...ORDER, terms: "FOB" });
    expect(terms()).toHaveValue("FOB");
    expect(screen.queryByRole("option", { name: "Not set" })).toBeNull();
    await user.selectOptions(terms(), "CNF");
    await user.click(save);
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/orders/PO-2051", { terms: "CNF" }));
  });

  it("lets an older order without terms set them, and sends nothing while left as Not set", async () => {
    const { user, setDate, save } = open({ ...ORDER, stage: 2, terms: null });
    expect(terms()).toHaveValue("");
    setDate(/^Delivery date/, "2026-11-20");
    await user.click(save);
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/orders/PO-2051", { deliveryDate: "2026-11-20" }));
  });

  it("is fixed (read-only, never sent) once a container holds the order", async () => {
    patch.mockResolvedValue({});
    const { user, box, setDate, save } = open({ ...ORDER, stage: 3, terms: "FOB" });
    expect(screen.queryByRole("combobox", { name: "Container terms" })).toBeNull();
    expect(box("Container terms")).toHaveValue("FOB");
    expect(box("Container terms")).toHaveAttribute("readonly");
    expect(screen.getByText("A container already holds this order, so its container terms are fixed.")).toBeVisible();
    setDate(/^Delivery date/, "2026-12-01");
    await user.click(save);
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/orders/PO-2051", { deliveryDate: "2026-12-01" }));
  });

  it("shows the API's terms refusal under the field (a container took the order meanwhile)", async () => {
    const locked = "This order is already loaded in a container, so its container terms can't change.";
    patch.mockRejectedValue(new ApiError(422, "validation_failed", "Some fields need attention.", { terms: locked }));
    const { user, save } = open({ ...ORDER, stage: 2, terms: "FOB" });
    await user.selectOptions(terms(), "CNF");
    await user.click(save);
    expect(await screen.findByText(locked)).toBeVisible();
    expect(terms()).toHaveAttribute("aria-invalid", "true");
  });
});
