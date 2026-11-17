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
  orderValueCny: 2000,
  paidCny: 1000,
  paidInr: 12500,
  balanceCny: 1000,
  paymentStatus: "partly",
  landedCostInr: null,
  perPieceInr: null,
  ...over,
});
const data: OrderReportsResponse = {
  rows: [
    row({}),
    row({ id: "o2", po: "PO-3002", orderValueCny: 800, paidCny: 800, paidInr: 10000, balanceCny: 0, paymentStatus: "paid" }),
    row({ id: "o3", po: "PO-3003", orderValueCny: 1000, paidCny: 1500, paidInr: 18750, balanceCny: -500, paymentStatus: "paid" }),
  ],
  // The API's signed total (1000 + 0 - 500): the page must show 1,000 instead.
  summary: { orders: 3, byCurrency: [{ currency: "CNY", orderValueCny: 3800, paidCny: 3300, balanceCny: 500 }], paidInr: 41250, landedCostInr: 0 },
  filter: { po: null, supplierName: null, supplier: null, from: null, to: null, status: null, stage: null, currency: null, warehouse: null, paymentStatus: null },
  options: { suppliers: [], warehouses: [] },
};

describe("Order reports page: the outstanding balance never shows below 0", () => {
  it("floors each order's balance at 0 and totals only what is owed", () => {
    render(<OrderReportsScreen page={{ data, today: "2026-11-17", search: "", query: "" }} linkPos={false} />);
    const balanceKpi = screen.getAllByText("Balance").find((el) => el.tagName === "P")!.parentElement!;
    expect(within(balanceKpi).getByText("¥1,000")).toBeInTheDocument();
    expect(balanceKpi).not.toHaveTextContent("¥500");

    const table = screen.getByRole("table");
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((th) => th.textContent);
    // Sortable headers end with their sort icon ("Balance⇅").
    const at = headers.findIndex((header) => /^Balance\W*$/.test(header ?? ""));
    const balanceOf = (po: string) => within(within(table).getByText(po).closest("tr")!).getAllByRole("cell")[at]!.textContent;
    expect(balanceOf("PO-3001")).toBe("¥1,000");
    expect(balanceOf("PO-3002")).toBe("¥0");
    expect(balanceOf("PO-3003")).toBe("¥0");
    expect(table).not.toHaveTextContent("-¥500");
    expect(screen.getByText(/balance\s+shows 0 and adds nothing to the totals/)).toBeInTheDocument();
  });
});
