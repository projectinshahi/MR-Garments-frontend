import type { TransportRow, TransportState } from "./data/queries";

export const ALL = "all";

export type TransportFilters = { query: string; company: string; state: TransportState | typeof ALL };

/** Route slug for a container: "CAIU 2298076" → "CAIU-2298076". */
export const containerSlug = (container: string) => container.replace(/\s+/g, "-");

/** Client-side list filtering: vehicle, LR or PO search, transport company and the status chip. */
export function filterTransports<T extends TransportRow>(rows: T[], { query, company, state }: TransportFilters) {
  const q = query.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!q || [r.vehicle, r.lr, ...r.orders].some((value) => value.toLowerCase().includes(q))) &&
      (company === ALL || r.company === company) &&
      (state === ALL || r.state === state),
  );
}

/** Totals row: "Total, 4 vehicles" and the summed transport cost. */
export function transportTotals(rows: TransportRow[]) {
  return {
    label: `Total, ${rows.length} ${rows.length === 1 ? "vehicle" : "vehicles"}`,
    cost: rows.reduce((sum, r) => sum + r.cost, 0),
  };
}

/** KPI tiles for the period (all listed vehicles, before filters). */
export function transportKpis(rows: TransportRow[]) {
  const delivered = rows.filter((r) => r.state === "delivered");
  return {
    onTheWay: rows.length - delivered.length,
    delivered: delivered.length,
    bundlesDelivered: delivered.reduce((sum, r) => sum + r.bundlesReceived, 0),
    cost: transportTotals(rows).cost,
  };
}
