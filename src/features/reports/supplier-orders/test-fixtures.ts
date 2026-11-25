import type { SupplierOrderRow, SupplierOrdersResponse } from "@/lib/api/reports-types";

// Supplier order details (RPT-S1) test data: one supplier, a USD order in full (lines, a container, cost parts) and a CNY
// order with goods received (no USD rate saved).

export const TODAY = "2026-11-24";
export const row = (over: Partial<SupplierOrderRow>): SupplierOrderRow => ({
  id: "o1",
  po: "PO-2050",
  orderDate: "2026-10-10",
  deliveryDate: "2026-11-19",
  stage: 6,
  supplier: { id: "s1", name: "Ningbo Knits", code: "SUP-001" },
  currency: "USD",
  exchangeRate: 88,
  orderValueInr: 105600,
  item: "Denim jeans",
  quantity: 100,
  unit: "pcs",
  received: 120,
  stocked: 100,
  lineCount: 2,
  quantities: [
    { unit: "pcs", quantity: 100 },
    { unit: "m", quantity: 50 },
  ],
  closed: false,
  closedOn: null,
  orderValueCny: 1440,
  poValueCny: 1400,
  usdRate: 88,
  dollarCost: 1440,
  held: false,
  settledCny: 800,
  outstandingCny: 640,
  paymentStatus: "partly",
  settledInr: 70400,
  agentPaidInr: 0,
  paidInr: 70400,
  depositRequiredCny: null,
  depositSettledCny: 800,
  depositPendingCny: null,
  depositStatus: "none",
  landedCostInr: 120000,
  perPieceInr: 800,
  lines: [
    { item: "Denim jeans", unit: "pcs", ordered: 100, received: 120, rate: 10, poValueCny: 1000, orderValueCny: 1200, dollarCost: 1200 },
    { item: "Cotton fabric", unit: "m", ordered: 50, received: 30, rate: 8, poValueCny: 400, orderValueCny: 240, dollarCost: 240 },
  ],
  containers: [{ number: "RPTU 1000001", status: "sea", terms: "FOB", loadedOn: "2026-10-20", sailedOn: "2026-10-22", eta: "2026-11-30", quantity: 150 }],
  landedCost: { goodsInr: 70400, seaFreightInr: 9600, clearingInr: 30000, transportInr: 10000, totalInr: 120000, perPieceInr: 800, final: false, waitingFor: "supplier payment" },
  ...over,
});
export const cny = row({
  id: "o2",
  po: "PO-2051",
  currency: "CNY",
  exchangeRate: 12,
  orderValueCny: 500,
  poValueCny: 500,
  usdRate: null,
  dollarCost: null,
  settledCny: 500,
  outstandingCny: 0,
  paymentStatus: "paid",
  lines: [{ item: "Polo shirts", unit: "pcs", ordered: 100, received: 100, rate: 5, poValueCny: 500, orderValueCny: 500, dollarCost: null }],
  containers: [],
  landedCost: null,
  landedCostInr: null,
});
const totals = (currency: "USD" | "CNY", value: number, po: number, settled: number, outstanding: number) => ({ currency, orderValueCny: value, poValueCny: po, settledCny: settled, outstandingCny: outstanding });
export const data: SupplierOrdersResponse = {
  suppliers: [
    {
      supplier: { id: "s1", name: "Ningbo Knits" },
      orders: 2,
      byCurrency: [totals("CNY", 500, 500, 500, 0), totals("USD", 1440, 1400, 800, 640)],
      dollarCost: { usd: null, missing: 1 },
      landedCostInr: 120000,
      rows: [row({}), cny],
    },
  ],
  summary: {
    orders: 2,
    suppliers: 1,
    byCurrency: [totals("CNY", 500, 500, 500, 0), totals("USD", 1440, 1400, 800, 640)],
    dollarCost: { usd: null, missing: 1 },
    paidInr: 76400,
    landedCostInr: 120000,
  },
  filter: { po: null, supplierName: null, supplier: "Ningbo Knits", from: null, to: null, status: null, stage: null, currency: null, warehouse: null, paymentStatus: null },
  options: { suppliers: [], warehouses: [] },
};
