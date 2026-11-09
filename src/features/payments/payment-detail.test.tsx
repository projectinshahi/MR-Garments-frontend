import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { OrderPaymentRow, Payment } from "./data/queries";
import { PaymentDetailCard } from "./payment-detail";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const order: OrderPaymentRow = { orderId: "o2", po: "PO-3002", supplier: "Hangzhou Silk", currency: "CNY", orderValue: 20_000, paid: 5_000, paidInr: 60_000, balance: 15_000, nextDue: null };
const payment = (patch: Partial<Payment>): Payment => ({
  id: "p1",
  orderId: "o2",
  po: "PO-3002",
  currency: "CNY",
  kind: "Deposit",
  payee: "Hangzhou Silk",
  payeeRole: "supplier",
  amountCny: 5_000,
  status: "paid",
  paidOn: "2026-10-01",
  dueDate: null,
  rateInr: 12,
  mode: "Bank transfer",
  reference: "",
  notes: "",
  ...patch,
});

describe("PaymentDetailCard", () => {
  it("shows a payment's reference and notes only when recorded (migration 0008)", () => {
    const { unmount } = render(<PaymentDetailCard order={order} payments={[payment({ reference: "UTR 123", notes: "Second half" })]} agents={null} linkPo={false} />);
    expect(screen.getByText("Reference").nextSibling).toHaveTextContent("UTR 123");
    expect(screen.getByText("Notes").nextSibling).toHaveTextContent("Second half");
    unmount();

    render(<PaymentDetailCard order={order} payments={[payment({})]} agents={null} linkPo={false} />);
    expect(screen.queryByText("Reference")).not.toBeInTheDocument();
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
    expect(screen.getByText("Bank transfer")).toBeInTheDocument();
  });
});
