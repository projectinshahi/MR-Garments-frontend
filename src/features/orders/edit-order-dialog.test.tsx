import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { OrderDetail } from "@/lib/api/types";

import { EditOrderDialog, type EditableOrder, type ItemOption } from "./edit-order-dialog";

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { patch: vi.fn() } }));
const patch = vi.mocked(apiClient.patch);

const ITEMS: ItemOption[] = [
  { id: "i-1", name: "Denim jeans", unit: "pcs" },
  { id: "i-2", name: "Cotton fabric", unit: "m" },
];
const line = (id: string, item: { id: string; name: string }, quantity: number, rateCny: number): OrderDetail["lines"][number] => ({
  id,
  position: 0,
  item,
  unit: "pcs",
  quantity,
  rateCny,
  valueCny: quantity * rateCny,
  received: 0,
  loaded: 0,
});
// Line 2's item (Silk scarves) has been deactivated since the order was placed: ORD-2 no longer lists it.
const ORDER: EditableOrder = {
  po: "PO-2051",
  stage: 1,
  orderDate: "2026-10-01",
  deliveryDate: "2026-11-15",
  paidCny: 1000,
  lines: [line("l-1", { id: "i-1", name: "Denim jeans" }, 100, 10), line("l-2", { id: "i-9", name: "Silk scarves" }, 50, 20)],
};
const BELOW_PAID = "The order total can't be less than the ¥1,000.00 already paid.";

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
    expect(screen.getByRole("dialog", { name: "Edit order" })).toHaveTextContent("the order total can't be less than what's already paid");
    expect(screen.getByRole("status", { name: "Order total" })).toHaveTextContent("¥ 2,000.00");
    expect(screen.getByText("Paid so far ¥ 1,000.00")).toBeVisible();

    setDate(/^Delivery date/, "2026-11-20");
    await user.clear(box("Quantity, line 1"));
    await user.type(box("Quantity, line 1"), "120");
    await user.click(screen.getByRole("button", { name: "Remove line 2" }));
    await user.click(screen.getByRole("button", { name: "+ Add item" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Item, line 2" }), "Cotton fabric");
    await user.type(box("Rate (¥), line 2"), "8");
    await user.type(box("Quantity, line 2"), "500");
    expect(screen.getByRole("status", { name: "Order total" })).toHaveTextContent("¥ 5,200.00");

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

  it("refuses a total below what's paid before calling the API, and keeps at least one line", async () => {
    const { user, box, save } = open();
    await user.click(screen.getByRole("button", { name: "Remove line 2" }));
    expect(screen.getByRole("button", { name: "Remove line 1" })).toBeDisabled();
    await user.clear(box("Quantity, line 1"));
    await user.type(box("Quantity, line 1"), "1");
    await user.click(save);
    expect(await screen.findByText(BELOW_PAID)).toBeVisible();
    expect(patch).not.toHaveBeenCalled();
  });

  it("shows the API's field errors under their fields, the lines one under the table, and stays open", async () => {
    const before = "The delivery date can't be before the order date.";
    patch.mockRejectedValue(new ApiError(422, "validation_failed", "Check the highlighted fields.", { deliveryDate: before, lines: BELOW_PAID }));
    const { user, onClose, setDate, save } = open();
    setDate(/^Delivery date/, "2026-11-20");
    await user.click(save);
    expect(await screen.findByText(before)).toBeVisible();
    expect(screen.getByText(BELOW_PAID)).toBeVisible();
    expect(toast.error).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("a 409 without fields toasts the API's message and keeps the dialog and its values", async () => {
    const locked = "Goods have been received for this order, so only the delivery date can change.";
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

describe("Edit order at stages 2-5", () => {
  it("shows only the delivery date as editable and sends only deliveryDate", async () => {
    patch.mockResolvedValue({});
    const { user, date, setDate, save } = open({ ...ORDER, stage: 2 });
    expect(screen.getByRole("dialog", { name: "Edit order" })).toHaveTextContent(
      "Goods have been received for this order, so only the delivery date can change.",
    );
    expect(date(/^Order date/)).toHaveAttribute("readonly");
    expect(screen.getByText("Silk scarves")).toBeVisible();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "+ Add item" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Remove line/ })).toBeNull();

    setDate(/^Delivery date/, "2026-12-01");
    await user.click(save);
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/orders/PO-2051", { deliveryDate: "2026-12-01" }));
  });
});
