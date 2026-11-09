import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DepositStatus } from "@/lib/api/types";

import type { OrderPaymentRow, Payment } from "./data/queries";
import { PaymentDetailCard } from "./payment-detail";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const order: OrderPaymentRow = {
  orderId: "o2",
  po: "PO-3002",
  supplier: "Hangzhou Silk",
  currency: "CNY",
  orderValue: 20_000,
  paid: 5_000,
  paidInr: 60_000,
  supplierPaid: 5_000,
  supplierPaidInr: 60_000,
  balance: 15_000,
  depositRequired: null,
  depositPaid: 0,
  depositPending: null,
  depositStatus: "none",
  nextDue: null,
};
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
  amountInr: 60_000,
  ...patch,
});
const value = (label: string) => screen.getByText(label).nextSibling;

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

  it("shows the supplier's figures and the balance owed to the supplier, with the agents' sea freight apart only when any", () => {
    const { unmount } = render(<PaymentDetailCard order={order} payments={[payment({})]} agents={null} linkPo={false} />);
    expect(value("Paid to supplier")).toHaveTextContent("¥ 5,000");
    expect(value("Paid (INR), all payees")).toHaveTextContent("₹60,000");
    expect(value("Balance to supplier")).toHaveTextContent("¥ 15,000");
    expect(screen.queryByText("Paid to agents (sea freight)")).not.toBeInTheDocument();
    expect(screen.queryByText("Deposit required")).not.toBeInTheDocument();
    unmount();

    // ¥500 sea freight to an agent (PAY-1 paid - supplierPaid): in the INR total, never in the supplier's figures or the balance.
    render(<PaymentDetailCard order={{ ...order, paid: 5_500, paidInr: 66_250 }} payments={[payment({})]} agents={null} linkPo={false} />);
    expect(value("Paid to supplier")).toHaveTextContent("¥ 5,000");
    expect(value("Paid to agents (sea freight)")).toHaveTextContent("¥ 500");
    expect(value("Paid (INR), all payees")).toHaveTextContent("₹66,250");
    expect(value("Balance to supplier")).toHaveTextContent("¥ 15,000");
  });

  it("shows the deposit the supplier asked for with its standing, even before any payment", () => {
    const cases: [DepositStatus, number, number, string, string][] = [
      ["due", 0, 8_000, "¥ 8,000", "Deposit due"],
      ["partly", 5_000, 3_000, "¥ 3,000", "Deposit partly paid"],
      ["paid", 8_000, 0, "¥ 0", "Deposit paid"],
    ];
    for (const [depositStatus, depositPaid, depositPending, pending, pill] of cases) {
      const { unmount } = render(
        <PaymentDetailCard order={{ ...order, depositRequired: 8_000, depositPaid, depositPending, depositStatus }} payments={[]} agents={null} linkPo={false} />,
      );
      expect(screen.getByText("No payments recorded for PO-3002 yet.")).toBeInTheDocument();
      expect(value("Deposit required")).toHaveTextContent("¥ 8,000");
      expect(value("Deposit pending")).toHaveTextContent(pending);
      expect(screen.getByText(pill, { selector: "span" })).toBeInTheDocument();
      unmount();
    }
  });
});

describe("PaymentDetailCard with the API's figures (phase 2 final fixes, 1 and 2)", () => {
  it("shows each payment's INR as the API rounded it in SQL, never amount × rate recomputed here", () => {
    // ¥100 × 11.75 would be ₹1,175 here; the API says ₹1,176: its paisa rounding is the one every total uses.
    render(<PaymentDetailCard order={order} payments={[payment({ amountCny: 100, rateInr: 11.75, amountInr: 1_176 })]} agents={null} linkPo={false} />);
    expect(screen.getByText("₹1,176")).toBeInTheDocument();
    expect(screen.queryByText("₹1,175")).not.toBeInTheDocument();
  });

  it("shows dashes, not every payee's figures, when an older API sends no supplier split, deposit fields or amountInr", () => {
    const legacy: OrderPaymentRow = { ...order, supplierPaid: null, supplierPaidInr: null, balance: null };
    const old = { ...payment({}), amountInr: undefined } as unknown as Payment;
    render(<PaymentDetailCard order={legacy} payments={[old]} agents={null} linkPo={false} />);
    expect(value("Paid to supplier")).toHaveTextContent("–");
    expect(value("Balance to supplier")).toHaveTextContent("–");
    expect(value("Paid (INR), all payees")).toHaveTextContent("₹60,000");
    expect(screen.queryByText("Paid to agents (sea freight)")).not.toBeInTheDocument();
    expect(screen.queryByText("Deposit required")).not.toBeInTheDocument();
    expect(screen.queryByText("₹60,000", { selector: "span" })).not.toBeInTheDocument();
  });
});
