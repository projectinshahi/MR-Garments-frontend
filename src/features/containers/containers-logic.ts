import type { ContainerRow, ContainerStatus, LoadLine, OrderLoad } from "./data/queries";

export const ALL = "all";

/** "active" = every listed container; "finished" matches none of the transcribed rows. */
export type ContainerChip = "active" | "finished" | ContainerStatus;

export type ContainerFilters = { query: string; agent: string; terms: string; chip: ContainerChip };

/** Client-side list filtering: container or PO search, agent, terms and status chip. */
export function filterContainers(rows: ContainerRow[], { query, agent, terms, chip }: ContainerFilters) {
  const q = query.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!q || r.number.toLowerCase().includes(q) || r.orders.some((po) => po.toLowerCase().includes(q))) &&
      (agent === ALL || r.agent === agent) &&
      (terms === ALL || r.terms === terms) &&
      (chip === "active" || r.status === chip),
  );
}

/** Chip labels with their counts, as shown: "Active (6)", "On the way (4)", "Loading (1)", "Arrived (1)", "Finished". */
export function containerChips(rows: ContainerRow[]): { value: ContainerChip; label: string }[] {
  const count = (status: ContainerStatus) => rows.filter((r) => r.status === status).length;
  return [
    { value: "active", label: `Active (${rows.length})` },
    { value: "sea", label: `On the way (${count("sea")})` },
    { value: "loading", label: `Loading (${count("loading")})` },
    { value: "arrived", label: `Arrived (${count("arrived")})` },
    { value: "finished", label: "Finished" },
  ];
}

/** Digits typed into a bundles or quantity field ("1,160 pcs" → 1160); empty counts as 0. */
export const parseCount = (text: string) => Number(text.replace(/\D/g, "")) || 0;

/** "Contents at a glance": distinct orders, item lines and total bundles. */
export function contents(lines: Pick<LoadLine, "po" | "bundles">[]) {
  return {
    orders: new Set(lines.map((l) => l.po)).size,
    lines: lines.length,
    bundles: lines.reduce((sum, l) => sum + l.bundles, 0),
  };
}

/** "Where each order is loaded": the order's tracked line quantity against its ordered total. */
export function orderLoaded(load: OrderLoad, lines: Pick<LoadLine, "id" | "quantity">[]) {
  return lines.find((l) => l.id === load.lineId)?.quantity ?? 0;
}
