import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { OrderPayment, OrderView } from "@/features/order-detail/data/queries";
import type { DepositStatus } from "@/lib/api/types";

import { PaymentsScreen } from "./payments-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/order-detail/shared/order-detail-frame", () => ({ OrderContextStrip: () => null }));

// ORD-4 (phase 2 fixes, 1): ¥5,000 paid to the supplier and ¥500 sea freight to an agent on a ¥20,000 order.
const order = {
  po: "PO-3002",
  currency: "CNY",
  supplier: { id: "s1", name: "Hangzhou Silk" },
  orderValueCny: 20_000,
  paidCny: 5_500,
  paidInr: 66_250,
  supplierPaidCny: 5_000,
  supplierPaidInr: 60_000,
  balanceCny: 15_000,
  depositRequiredCny: null,
  depositPaidCny: 0,
  depositPendingCny: null,
  depositStatus: "none",
} as OrderView;
const paid = (id: string, patch: Partial<OrderPayment>): OrderPayment => ({
  id,
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
// The API rounds INR in SQL: the row shows its figure, never amount × rate recomputed here (500 × 12.5 would be 6,250).
const freight = paid("p2", { kind: "Balance", payee: "Sino Freight", payeeRole: "agent", amountCny: 500, paidOn: "2026-10-05", rateInr: 12.5, mode: "Cash", amountInr: 6_251 });
const due = paid("p3", { kind: "Balance", amountCny: 15_000, status: "due", paidOn: null, dueDate: "2026-11-12", rateInr: null, mode: null, amountInr: null });
const payments = [paid("p1", {}), freight, due];

const kpi = (label: string) => screen.getByText(label, { selector: "p" }).parentElement!;
const value = (label: string) => screen.getByText(label).nextSibling;

describe("PaymentsScreen (order detail)", () => {
  it("shows what the supplier was paid and is still owed, with the agents' sea freight apart", () => {
    render(<PaymentsScreen order={order} payments={payments} />);
    expect(kpi("Paid to supplier")).toHaveTextContent("¥5,0001 payment · agents ¥500");
    expect(kpi("Balance to supplier")).toHaveTextContent("¥15,000");
    expect(screen.queryByText("Fully paid")).not.toBeInTheDocument();
    expect(screen.queryByText("Deposit", { selector: "p" })).not.toBeInTheDocument();
    // The INR working: supplier payments add up to the supplier's INR; the agents' under their own total.
    expect(value("¥5,000 × 12.00")).toHaveTextContent("₹60,000");
    expect(value("Paid to supplier in INR")).toHaveTextContent("₹60,000");
    expect(value("¥500 × 12.50 · Sino Freight")).toHaveTextContent("₹6,251");
    expect(value("Paid to agents (sea freight) in INR")).toHaveTextContent("₹6,250");
  });

  it("rows show the API's INR figure, and the footer totals every payee", () => {
    render(<PaymentsScreen order={order} payments={payments} />);
    const table = screen.getByRole("table");
    expect(within(table).getByRole("row", { name: /Sino Freight/ })).toHaveTextContent("₹6,251");
    expect(within(table).getByRole("row", { name: /12 Nov 2026/ })).not.toHaveTextContent("₹");
    const footer = within(table).getAllByRole("row").at(-1)!;
    expect(footer).toHaveTextContent("Total paid (all payees)");
    expect(footer).toHaveTextContent("¥5,500");
    expect(footer).toHaveTextContent("₹66,250");
  });

  it("says Fully paid once the supplier is owed nothing, and leaves the agents out when they were paid nothing", () => {
    const settled = { ...order, paidCny: 20_000, paidInr: 240_000, supplierPaidCny: 20_000, supplierPaidInr: 240_000, balanceCny: 0 };
    render(<PaymentsScreen order={settled} payments={[paid("p1", { amountCny: 20_000, amountInr: 240_000 })]} />);
    expect(kpi("Paid to supplier")).toHaveTextContent("¥20,0001 payment");
    expect(kpi("Paid to supplier")).not.toHaveTextContent("agents");
    expect(kpi("Balance to supplier")).toHaveTextContent("Fully paid");
    expect(screen.queryByText("Paid to agents (sea freight) in INR")).not.toBeInTheDocument();
  });

  it("adds a Deposit KPI only when the supplier asked for one, with what is pending and its standing", () => {
    const cases: [DepositStatus, number, number, string, string][] = [
      ["due", 0, 8_000, "¥8,000¥0 of ¥8,000", "Deposit due"],
      ["partly", 5_000, 3_000, "¥3,000¥5,000 of ¥8,000", "Deposit partly paid"],
      ["paid", 8_000, 0, "¥0¥8,000 of ¥8,000", "Deposit paid"],
    ];
    for (const [depositStatus, depositPaidCny, depositPendingCny, text, pill] of cases) {
      const { unmount } = render(<PaymentsScreen order={{ ...order, depositRequiredCny: 8_000, depositPaidCny, depositPendingCny, depositStatus }} payments={payments} />);
      const card = kpi("Deposit");
      expect(card).toHaveTextContent(text);
      expect(within(card).getByText(pill)).toBeInTheDocument();
      unmount();
    }
  });
});
