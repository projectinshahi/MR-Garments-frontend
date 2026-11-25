import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { OrderReportRow, OrderReportsResponse } from "@/lib/api/reports-types";

import { OrderReportsScreen } from "./order-reports-screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/reports/orders",
  useSearchParams: () => new URLSearchParams(),
}));

const row = (over: Partial<OrderReportRow>): OrderReportRow => ({
  id: "o1",
  po: "PO-3001",
  orderDate: "2026-10-10",
  deliveryDate: "2026-11-19",
  stage: 2,
  supplier: { id: "s1", name: "Guangzhou Textile Co.", code: "SUP-001" },
  currency: "CNY",
  exchangeRate: 12.5,
  orderValueInr: null,
  item: "Denim jeans",
  quantity: 100,
  unit: "pcs",
  received: 0,
  stocked: 0,
  lineCount: 1,
  quantities: [{ unit: "pcs", quantity: 100 }],
  closed: false,
  closedOn: null,
  orderValueCny: 2000, poValueCny: 2000,
  usdRate: null,
  dollarCost: null,
  held: false,
  settledCny: 1000,
  outstandingCny: 1000,
  paymentStatus: "partly",
  settledInr: 12500,
  agentPaidInr: 0,
  paidInr: 12500,
  depositRequiredCny: null,
  depositSettledCny: 1000,
  depositPendingCny: null,
  depositStatus: "none",
  landedCostInr: null,
  perPieceInr: null,
  ...over,
});
const data: OrderReportsResponse = {
  rows: [
    row({}),
    row({ id: "o2", po: "PO-3002", orderValueCny: 800, poValueCny: 800, settledCny: 800, outstandingCny: 0, paidInr: 10000, paymentStatus: "paid" }),
    row({ id: "o3", po: "PO-3003", orderValueCny: 1000, poValueCny: 1000, held: true, settledCny: null, outstandingCny: null, paymentStatus: null, settledInr: null, paidInr: null, depositStatus: null }),
  ],
  summary: { orders: 3, byCurrency: [{ currency: "CNY", orderValueCny: 3800, poValueCny: 3800, settledCny: 1800, outstandingCny: 1000 }], dollarCost: { usd: null, missing: 1 }, paidInr: 22500, landedCostInr: 0 },
  filter: { po: null, supplierName: null, supplier: null, from: null, to: null, status: null, stage: null, currency: null, warehouse: null, paymentStatus: null },
  options: { suppliers: [], warehouses: [] },
};

describe("Order reports page: settled and outstanding from the supplier ledger", () => {
  it("shows the API's summary and each order's projection; a held order has no figures", () => {
    render(<OrderReportsScreen page={{ data, today: "2026-11-17", search: "", query: "" }} linkPos={false} />);
    const kpi = (label: string) => screen.getAllByText(label).find((el) => el.tagName === "P")!.parentElement!;
    expect(within(kpi("Outstanding")).getByText("¥1,000")).toBeInTheDocument();
    expect(within(kpi("Settled")).getByText("¥1,800")).toBeInTheDocument();

    const table = screen.getByRole("table");
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((th) => th.textContent);
    // Sortable headers end with their sort icon ("Outstanding⇅").
    const at = headers.findIndex((header) => /^Outstanding\W*$/.test(header ?? ""));
    const cells = (po: string) => within(within(table).getByText(po).closest("tr")!).getAllByRole("cell");
    expect(cells("PO-3001")[at]!.textContent).toBe("¥1,000");
    expect(cells("PO-3002")[at]!.textContent).toBe("¥0");
    expect(cells("PO-3003")[at]!.textContent).toBe("–");
    expect(cells("PO-3003")[at - 1]).toHaveTextContent("Pending review");
    expect(cells("PO-3002")[at - 1]).toHaveTextContent("Paid");
  });

  // Owner request of 2026-11-24: a Dollar Cost column, no supplier code (the name stays).
  it("shows Dollar Cost (the API's), says when no USD rate is saved, and no longer shows the supplier code", () => {
    const rows = data.rows.map((r) => (r.po === "PO-3002" ? { ...r, currency: "USD" as const, dollarCost: 800 } : r));
    render(<OrderReportsScreen page={{ data: { ...data, rows }, today: "2026-11-17", search: "", query: "" }} linkPos={false} />);
    const table = screen.getByRole("table");
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((th) => th.textContent?.replace(/[^\w)]*$/, ""));
    const at = headers.indexOf("Dollar Cost");
    expect(at).toBeGreaterThan(headers.indexOf("Value (received)"));
    expect(headers).not.toContain("Supplier code");
    const cells = (po: string) => within(within(table).getByText(po).closest("tr")!).getAllByRole("cell");
    expect(cells("PO-3002")[at]!.textContent).toBe("$800");
    expect(cells("PO-3001")[at]!.textContent).toBe("No USD rate saved");
    expect(within(table).queryByText("SUP-001")).not.toBeInTheDocument();
    expect(within(table).getAllByText("Guangzhou Textile Co.")).toHaveLength(3);
  });
});
