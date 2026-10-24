import type { ClearingRow, ClearingState } from "./data/queries";

export const ALL = "all";

export type ClearingFilters = { query: string; agent: string; state: ClearingState | typeof ALL };

/** Client-side list filtering: container or PO search, clearing agent and status chip. */
export function filterClearings(rows: ClearingRow[], { query, agent, state }: ClearingFilters) {
  const q = query.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!q || r.container.toLowerCase().includes(q) || r.orders.some((po) => po.toLowerCase().includes(q))) &&
      (agent === ALL || r.agent === agent) &&
      (state === ALL || r.state === state),
  );
}

/** Total clearing cost: duty, taxes and charges. The value of goods for duty is not part of it. */
export const clearingTotal = (charges: { amount: number }[]) => charges.reduce((sum, charge) => sum + charge.amount, 0);
