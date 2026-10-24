import type { CostGroup, OrderCost } from "./data/queries";

const GROUPS: CostGroup[] = ["goods", "duty", "transport"];

/** Landed cost, cost per piece, and the "Where the money goes" groups with their rounded share and per-piece part. */
export function summarizeCost({ pieces, lines }: OrderCost) {
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const groups = GROUPS.map((group) => {
    const value = lines.filter((line) => line.group === group).reduce((sum, line) => sum + line.amount, 0);
    return { group, value, percent: Math.round((value / total) * 100), perPiece: value / pieces };
  });
  return { total, perPiece: total / pieces, groups };
}
