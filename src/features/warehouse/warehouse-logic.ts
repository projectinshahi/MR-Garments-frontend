import type { WarehouseReceipt } from "./data/queries";

/** Client-side search by item or PO. */
export function filterReceipts(rows: WarehouseReceipt[], query: string) {
  const q = query.trim().toLowerCase();
  return q ? rows.filter((r) => r.item.toLowerCase().includes(q) || r.po.toLowerCase().includes(q)) : rows;
}

/** Totals row and KPIs: pieces per team and the received-weighted cost per piece (₹267.19 for the reference rows). */
export function summarizeReceipts(rows: WarehouseReceipt[]) {
  const sum = (pick: (r: WarehouseReceipt) => number) => rows.reduce((total, r) => total + pick(r), 0);
  const received = sum((r) => r.received);
  return {
    items: rows.length,
    received,
    retail: sum((r) => r.retail),
    wholesale: sum((r) => r.wholesale),
    online: sum((r) => r.online),
    costPerPiece: received ? sum((r) => r.received * r.costPerPiece) / received : 0,
  };
}

/** Pieces given to teams and pieces still unassigned. */
export function splitSummary(received: number, pieces: number[]) {
  const assigned = pieces.reduce((total, p) => total + p, 0);
  return { assigned, left: received - assigned };
}

/** A team's new quantity, capped so the teams never get more than was received. */
export function capTeamPieces(received: number, pieces: number[], index: number, value: number) {
  const others = pieces.reduce((total, p, i) => (i === index ? total : total + p), 0);
  return Math.max(0, Math.min(value, received - others));
}

/** Cost so far: total of the known costs and the cost per piece over the pieces received. */
export function costSoFar(cost: { goods: number; dutyTaxesClearing: number; transport: number }, received: number) {
  const total = cost.goods + cost.dutyTaxesClearing + cost.transport;
  return { total, perPiece: received ? total / received : 0 };
}

/** Cost by team: every piece carries the same cost per piece. */
export const teamCost = (pieces: number, perPiece: number) => pieces * perPiece;
