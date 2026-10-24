import { getOrderDetailHeader } from "@/features/order-detail/shared/queries";

import { overviews } from "./fixtures";

export type OrderOverview = NonNullable<Awaited<ReturnType<typeof getOrderOverview>>>;

/** Overview tab (06): header facts, journey, money, teams and activity, plus the derived landed cost. */
export async function getOrderOverview(po: string) {
  const header = await getOrderDetailHeader(po);
  const fixture = overviews[po];
  if (!header || !fixture) return undefined;
  const data = structuredClone(fixture);
  const landedCost = data.money.reduce((sum, row) => sum + row.inr, 0);
  return {
    ...data,
    header,
    landedCost,
    costPerPiece: landedCost / data.pieces,
    teamTotal: data.teams.reduce((sum, row) => sum + row.pieces, 0),
  };
}
