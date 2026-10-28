import type { LandedCostData, LandedCostRow } from "./data/queries";

const sum = <T>(rows: T[], pick: (row: T) => number) => rows.reduce((total, row) => total + pick(row), 0);

/** Share of the total per part, to one decimal place ("71.2%"). */
export function shareOfTotal(values: number[]) {
  const total = sum(values, (value) => value);
  return { total, percents: values.map((value) => (total ? Math.round((value / total) * 1000) / 10 : 0)) };
}

/** Goods payments' totals: each payment is already in INR at its own date's rate; the average is total INR / total ¥. */
export function convertPayments(payments: LandedCostRow["goodsPayments"]) {
  const totalCny = sum(payments, (p) => p.amountCny);
  const totalInr = sum(payments, (p) => p.amountInr);
  return { totalCny, totalInr, averageRate: totalCny ? totalInr / totalCny : 0 };
}

export type CostPartKey = "goods" | "seaFreight" | "duty" | "transport";
export type CostPart = { key: CostPartKey; label: string; qualifier?: string; value: number };

/** Where an order's landed cost goes. Sea freight is a part only when it adds to the cost (FOB, paid to an agent). */
export function breakdownParts(row: LandedCostRow): CostPart[] {
  return [
    { key: "goods", label: "Goods", qualifier: "paid to supplier, in INR", value: row.goodsInr },
    ...(row.seaFreightInr > 0 ? [{ key: "seaFreight" as const, label: "Sea freight", qualifier: "paid to agent (FOB)", value: row.seaFreightInr }] : []),
    { key: "duty", label: "Duty, taxes and clearing", value: row.clearingInr ?? 0 },
    { key: "transport", label: "Transport in India", value: row.transportInr ?? 0 },
  ];
}

export type TeamCost = { teamId: string; team: string; pieces: number; costInr: number; perPieceInr: number | null };

/**
 * "By team": each team's stocked pieces and their landed cost (pieces x the order's per piece), in team order. Built
 * from the orders' splits, so a team deactivated since keeps its stock (wave 3 section 4); it sorts after the active ones.
 * With the page's Team filter (`teamId`) the orders are only those that team received, so only that team is complete.
 */
export function costByTeam(rows: LandedCostRow[], teams: LandedCostData["teams"], teamId: string | null = null): TeamCost[] {
  const rank = new Map(teams.map(({ id }, index) => [id, index]));
  const byTeam = new Map<string, LandedCostRow["teams"]>();
  for (const split of rows.flatMap((row) => row.teams)) {
    if (!teamId || split.teamId === teamId) byTeam.set(split.teamId, [...(byTeam.get(split.teamId) ?? []), split]);
  }
  return [...byTeam.values()]
    .map((splits) => {
      const pieces = sum(splits, (split) => split.pieces);
      const costInr = sum(splits, (split) => split.costInr);
      return { teamId: splits[0]!.teamId, team: splits[0]!.team, pieces, costInr, perPieceInr: pieces > 0 ? costInr / pieces : null };
    })
    .filter((team) => team.pieces > 0)
    .sort((a, b) => (rank.get(a.teamId) ?? teams.length) - (rank.get(b.teamId) ?? teams.length));
}

/** "PO-2028", "PO-2028 and PO-2019", "PO-1, PO-2 and PO-3", "PO-1, PO-2 and 3 more". */
export function listPos(pos: string[]) {
  if (pos.length <= 1) return pos.join("");
  if (pos.length <= 3) return `${pos.slice(0, -1).join(", ")} and ${pos.at(-1)}`;
  return `${pos.slice(0, 2).join(", ")} and ${pos.length - 2} more`;
}
