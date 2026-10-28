import { addDays, formatISO, parseISO } from "date-fns";
import { z } from "zod";

import type { ContainerListItem, ContainerOptions, ContainerState, CreateContainerBody } from "@/lib/api/types";
import { formatQty } from "@/lib/formatters";

export const ALL = "all";

export type ContainerStatus = ContainerState;

/** A Containers list row, as shown. */
export type ContainerRow = {
  id: string;
  number: string;
  agent: string;
  terms: ContainerListItem["terms"];
  /** As shown: "PO-2037 (part)" marks an order split across containers. */
  orders: string[];
  bundles: number;
  /** null: not yet ("–"). */
  loadedOn: string | null;
  sailedOn: string | null;
  etaIndia: string;
  /** "Est. 24 Oct" */
  etaEstimated: boolean;
  status: ContainerStatus;
};

/** CON-1 row -> list row. */
export const toContainerRow = (item: ContainerListItem): ContainerRow => ({
  id: item.id,
  number: item.number,
  agent: item.agent.name,
  terms: item.terms,
  orders: item.orders.map((o) => (o.part ? `${o.po} (part)` : o.po)),
  bundles: item.bundles,
  loadedOn: item.loadedOn,
  sailedOn: item.sailedOn,
  etaIndia: item.eta,
  etaEstimated: item.etaEstimated,
  status: item.status,
});

/** "active" = every listed container; "finished" matches none (the API has no finished status yet). */
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

/** Chip labels with their counts: "Active (6)", "On the way (4)", "Loading (1)", "Arrived (1)", "Finished". */
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

/** The four KPI cards. "Arriving this week": at sea with an ETA up to 6 days after today (overdue ones included). */
export function containerKpis(rows: ContainerRow[], today: string) {
  const weekEnd = formatISO(addDays(parseISO(today), 6), { representation: "date" });
  const numbers = (keep: (r: ContainerRow) => boolean) => rows.filter(keep).map((r) => r.number);
  return {
    active: rows.length,
    arrivingThisWeek: numbers((r) => r.status === "sea" && r.etaIndia <= weekEnd),
    loadingNow: numbers((r) => r.status === "loading"),
    arrivedInClearing: numbers((r) => r.status === "arrived"),
  };
}

/** The note under the list, naming a split order when one is listed. */
export function listFootnote(rows: ContainerRow[]) {
  const split = rows.flatMap((r) => r.orders).find((o) => o.endsWith(" (part)"));
  return `An order can be split across containers${split ? ` (${split.replace(" (part)", "")} above)` : ""}, and one container can hold many orders.`;
}

/** Agent filter options: the agents of the listed containers. */
export const agentNames = (rows: ContainerRow[]) => [...new Set(rows.map((r) => r.agent))].sort();

/** Digits typed into a bundles or quantity field ("1,160 pcs" -> 1160); empty counts as 0. */
export const parseCount = (text: string) => Number(text.replace(/\D/g, "")) || 0;

// ---------------------------------------------------------------------------------------------------------------
// Load container form (CON-3)
// ---------------------------------------------------------------------------------------------------------------

export type LoadableLine = ContainerOptions["lines"][number];

const lineSchema = z.object({
  orderLineId: z.string(),
  po: z.string(),
  item: z.string(),
  unit: z.enum(["m", "pcs"]),
  received: z.number(),
  loaded: z.number(),
  bundles: z.string(),
  quantity: z.string(),
});
export type LoadLineValues = z.infer<typeof lineSchema>;

// Proposed wording: no approved messages exist for this form yet. The API checks the same rules (and uniqueness).
export const loadContainerSchema = z
  .object({
    number: z.string().trim().min(1, "Enter the container number."),
    shippingAgentId: z.string().min(1, "Choose a shipping agent."),
    terms: z.enum(["FOB", "CNF"]),
    portOfLoading: z.string(),
    portOfArrival: z.string(),
    loadedOn: z.string().min(1, "Enter the loading date."),
    sailedOn: z.string(),
    eta: z.string().min(1, "Enter the expected arrival date."),
    lines: z.array(lineSchema),
  })
  .superRefine((values, ctx) => {
    if (values.loadedOn && values.eta && values.eta < values.loadedOn)
      ctx.addIssue({ code: "custom", path: ["eta"], message: "The ETA can't be before the loading date." });
    values.lines.forEach((line, i) => {
      const left = line.received - line.loaded;
      if (parseCount(line.quantity) > left)
        ctx.addIssue({ code: "custom", path: ["lines", i, "quantity"], message: `Only ${formatQty(left, line.unit)} left to load.` });
    });
    if (!values.lines.some((line) => parseCount(line.quantity) > 0))
      ctx.addIssue({ code: "custom", path: ["lines"], message: "Enter a quantity for at least one line." });
  });
export type LoadContainerValues = z.infer<typeof loadContainerSchema>;

/** API field names, in screen order, so 409/422 `fields` land on them. */
export const LOAD_FIELDS = ["number", "shippingAgentId", "terms", "loadedOn", "eta", "lines"] as const;

/** An empty form: today as the loading date, FOB, every loadable line at 0 (not loaded). */
export const toLoadValues = (lines: LoadableLine[], today: string): LoadContainerValues => ({
  number: "",
  shippingAgentId: "",
  terms: "FOB",
  portOfLoading: "",
  portOfArrival: "",
  loadedOn: today,
  sailedOn: "",
  eta: "",
  lines: lines.map((line) => ({ ...line, bundles: "", quantity: "" })),
});

/** The CON-3 body: only lines with a quantity. */
export const toContainerBody = ({ lines, sailedOn, ...values }: LoadContainerValues): CreateContainerBody => ({
  number: values.number.trim(),
  shippingAgentId: values.shippingAgentId,
  terms: values.terms,
  portOfLoading: values.portOfLoading.trim(),
  portOfArrival: values.portOfArrival.trim(),
  loadedOn: values.loadedOn,
  sailedOn: sailedOn || null,
  eta: values.eta,
  lines: lines
    .map((line) => ({ orderLineId: line.orderLineId, bundles: parseCount(line.bundles), quantity: parseCount(line.quantity) }))
    .filter((line) => line.quantity > 0),
});

/** "Contents at a glance": distinct orders, item lines and total bundles of the lines being loaded. */
export function contents(lines: { po: string; bundles: number; quantity: number }[]) {
  const loading = lines.filter((l) => l.quantity > 0);
  return {
    orders: new Set(loading.map((l) => l.po)).size,
    lines: loading.length,
    bundles: loading.reduce((sum, l) => sum + l.bundles, 0),
  };
}

/** "Where each order is loaded": per line loaded, everything loaded so far (with this container) against received. */
export function lineLoads(lines: (Omit<LoadLineValues, "bundles" | "quantity"> & { quantity: number })[]) {
  return lines
    .filter((l) => l.quantity > 0)
    .map((l) => {
      const loaded = l.loaded + l.quantity;
      return { orderLineId: l.orderLineId, title: `${l.po} · ${l.item}`, loaded, received: l.received, rest: l.received - loaded, unit: l.unit };
    });
}
