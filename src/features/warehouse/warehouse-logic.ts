import type { ReceiveGoodsForm, SaveReceiptBody, WarehouseListRow } from "@/lib/api/stages-types";

export const ALL = "all";

/** "Retail team" → "Retail", as the list's column headers (30). */
export const teamLabel = (name: string) => name.replace(/ team$/i, "");

export type ReceiptFilters = { query: string; warehouse: string; team: string };

/** Client-side filtering: item or PO search, warehouse (location id) and team (rows with pieces for it). */
export function filterReceipts(rows: WarehouseListRow[], { query, warehouse, team }: ReceiptFilters) {
  const q = query.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!q || r.item.toLowerCase().includes(q) || r.po.toLowerCase().includes(q)) &&
      (warehouse === ALL || r.location.id === warehouse) &&
      (team === ALL || (r.teams[team] ?? 0) > 0),
  );
}

/** Totals row and KPIs: pieces per team id and the received-weighted cost per piece of the rows that have one. */
export function summarizeReceipts(rows: WarehouseListRow[]) {
  const teams: Record<string, number> = {};
  for (const row of rows) for (const [id, pieces] of Object.entries(row.teams)) teams[id] = (teams[id] ?? 0) + pieces;
  const costed = rows.filter((r) => r.costPerPieceInr !== null);
  const costedPieces = costed.reduce((sum, r) => sum + r.received, 0);
  return {
    items: rows.length,
    received: rows.reduce((sum, r) => sum + r.received, 0),
    teams,
    costPerPiece: costedPieces ? costed.reduce((sum, r) => sum + r.received * r.costPerPieceInr!, 0) / costedPieces : null,
  };
}

type Line = ReceiveGoodsForm["lines"][number];

/** Pieces per order line and team id. */
export type Split = Record<string, Record<string, number>>;

export type ReceiptValues = { locationId: string; receivedOn: string; receivedBy: string; bundlesReceived: string; split: Split };

/** WH-3 fields shown on the form; any other field's message is toasted. */
export const RECEIPT_FIELDS = ["locationId", "receivedOn", "receivedBy", "bundlesReceived", "lines"] as const;

/** The saved receipt, or a new one: the trip's warehouse, received the day it was unloaded, by the signed-in user. */
export function receiptValues({ trip, receipt, warehouses }: ReceiveGoodsForm, today: string, me: string): ReceiptValues {
  if (receipt) {
    const split: Split = {};
    for (const { orderLineId, teamId, quantity } of receipt.lines) (split[orderLineId] ??= {})[teamId] = quantity;
    return { locationId: receipt.locationId, receivedOn: receipt.receivedOn, receivedBy: receipt.receivedBy, bundlesReceived: String(receipt.bundlesReceived), split };
  }
  return {
    locationId: warehouses.some((w) => w.id === trip.destinationId) ? trip.destinationId : (warehouses[0]?.id ?? ""),
    receivedOn: trip.unloadedOn ?? today,
    receivedBy: me,
    bundlesReceived: trip.bundlesReceived === null ? "" : String(trip.bundlesReceived),
    split: {},
  };
}

/** Empty bundles stay null, which WH-3 refuses with its own message (0 is a valid count). */
export function toReceiptBody(values: ReceiptValues): Omit<SaveReceiptBody, "complete" | "bundlesReceived"> & { bundlesReceived: number | null } {
  return {
    locationId: values.locationId,
    receivedOn: values.receivedOn,
    receivedBy: values.receivedBy,
    bundlesReceived: values.bundlesReceived === "" ? null : Number(values.bundlesReceived),
    lines: Object.entries(values.split).flatMap(([orderLineId, teams]) =>
      Object.entries(teams)
        .filter(([, quantity]) => quantity > 0)
        .map(([teamId, quantity]) => ({ orderLineId, teamId, quantity })),
    ),
  };
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** A team's new quantity on a line, capped so the teams never get more than the line's quantity. */
export function capTeamPieces(line: Line, split: Split, teamId: string, value: number) {
  const others = sum(Object.entries(split[line.orderLineId] ?? {}).flatMap(([id, pieces]) => (id === teamId ? [] : [pieces])));
  return Math.max(0, Math.min(value, line.quantity - others));
}

/** Pieces given to teams over every line, and pieces still unassigned. */
export function splitSummary(lines: Line[], split: Split) {
  const total = sum(lines.map((line) => line.quantity));
  const assigned = sum(lines.flatMap((line) => Object.values(split[line.orderLineId] ?? {})));
  return { total, assigned, left: total - assigned };
}

/** A team's pieces over every line. */
export const teamPieces = (split: Split, teamId: string) => sum(Object.values(split).map((teams) => teams[teamId] ?? 0));

/** The unit the summary lines use: the lines' own when they share one. */
export const unitOf = (lines: Line[]) => (lines.every((line) => line.unit === lines[0]?.unit) ? (lines[0]?.unit ?? "pcs") : "units");

/** Cost so far over the orders' pieces (every line of the orders in this container). */
export function costSoFar(cost: NonNullable<ReceiveGoodsForm["cost"]>) {
  return { total: cost.totalInr, perPiece: cost.orderedPieces ? cost.totalInr / cost.orderedPieces : 0 };
}

/** Cost by team: every piece carries the same cost per piece. */
export const teamCost = (pieces: number, perPiece: number) => pieces * perPiece;
