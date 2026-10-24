import { listSuppliers, listTeams } from "@/lib/data/master";

import * as fixtures from "./fixtures";

export type { CostPartKey, GoodsPayment, OrderBreakdown, OrderCostRow } from "./fixtures";

export type LandedCostData = Awaited<ReturnType<typeof getLandedCost>>;

/** Landed Cost: orders, PO-2028's breakdown and goods payments, plus the header filter options. */
export async function getLandedCost() {
  const [suppliers, teams] = await Promise.all([listSuppliers(), listTeams()]);
  return structuredClone({
    orders: fixtures.orders,
    estimateReason: fixtures.estimateReason,
    breakdown: fixtures.breakdown,
    goodsPayments: fixtures.goodsPayments,
    suppliers: suppliers.map((s) => s.name),
    teams: teams.map((t) => t.name),
  });
}
