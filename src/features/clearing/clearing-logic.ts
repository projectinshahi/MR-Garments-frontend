import type { ClearingForm, ClearingListRow, SaveClearingBody } from "@/lib/api/stages-types";
import { formatINR, formatShortDate } from "@/lib/formatters";

import { amountOf, amountText, dateOf, progressSteps } from "./stage-form";

export const ALL = "all";

/** The list's status chips: waiting for the agent (nothing saved, or not handed over yet), duty to pay, cleared. */
export type ClearingState = "waiting" | "duty" | "cleared";

export type ClearingFilters = { query: string; agent: string; state: ClearingState | typeof ALL };

export function clearingState(row: Pick<ClearingListRow, "status" | "handedOn">): ClearingState {
  if (row.status === "cleared") return "cleared";
  return row.status === "waiting" || !row.handedOn ? "waiting" : "duty";
}

export function clearingStatusLabel(row: ClearingListRow) {
  const state = clearingState(row);
  if (state === "cleared") return `Cleared ${formatShortDate(row.clearedOn!)}`;
  if (state === "waiting") return "Waiting for agent";
  return row.dutyPaidOn ? `Duty paid ${formatShortDate(row.dutyPaidOn)}` : "Duty to pay";
}

const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const plural = (count: number, noun: string) => `${count} ${count === 1 ? noun : `${noun}s`}`;

/** Arrival at port to cleared, or to today while still at the port; "–" until the arrival is recorded. */
export const timeAtPort = (row: Pick<ClearingListRow, "arrivedOn" | "clearedOn">, today: string) =>
  row.arrivedOn ? plural(days(row.arrivedOn, row.clearedOn ?? today), "day") : "–";

/** Client-side list filtering: container or PO search, clearing agent (id) and status chip. */
export function filterClearings(rows: ClearingListRow[], { query, agent, state }: ClearingFilters) {
  const q = query.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!q || r.number.toLowerCase().includes(q) || r.orders.some((po) => po.toLowerCase().includes(q))) &&
      (agent === ALL || r.agent?.id === agent) &&
      (state === ALL || clearingState(r) === state),
  );
}

/** Total clearing cost: duty, taxes and charges. The value of goods for duty is not part of it. */
export const clearingTotal = (charges: { amount: number }[]) => charges.reduce((sum, charge) => sum + charge.amount, 0);

/** The duty lines of the form (25), in screen order, as API fields. */
export const CHARGES = [
  { key: "customsDutyInr", id: "customs-duty", label: "Customs duty" },
  { key: "otherDutiesInr", id: "other-duties", label: "Other duties and taxes" },
  { key: "agentChargesInr", id: "agent-charges", label: "Clearing agent charges" },
  { key: "portChargesInr", id: "port-charges", label: "Port and terminal charges" },
] as const;

/** Form values as typed: dates YYYY-MM-DD or "", amounts as cleanAmount text. */
export type ClearingValues = Record<Exclude<keyof SaveClearingBody, "complete">, string>;

/** CLR-3 fields shown on the form; any other field's message is toasted. */
export const CLEARING_FIELDS = ["clearingAgentId", "arrivedOn", "handedOn", "billOfEntry", "dutyPaidOn", "clearedOn", "goodsValueInr", ...CHARGES.map((c) => c.key)] as const;

/** The saved clearing, or a new one: the first agent, arrived on the ETA (today if the ETA is still ahead). */
export function clearingValues({ clearing, container, agents }: ClearingForm, today: string): ClearingValues {
  return {
    clearingAgentId: clearing?.clearingAgentId ?? agents[0]?.id ?? "",
    arrivedOn: clearing?.arrivedOn ?? (container.eta < today ? container.eta : today),
    handedOn: clearing?.handedOn ?? "",
    billOfEntry: clearing?.billOfEntry ?? "",
    dutyPaidOn: clearing?.dutyPaidOn ?? "",
    clearedOn: clearing?.clearedOn ?? "",
    goodsValueInr: amountText(clearing?.goodsValueInr),
    customsDutyInr: amountText(clearing?.customsDutyInr),
    otherDutiesInr: amountText(clearing?.otherDutiesInr),
    agentChargesInr: amountText(clearing?.agentChargesInr),
    portChargesInr: amountText(clearing?.portChargesInr),
  };
}

export function toClearingBody(values: ClearingValues): Omit<SaveClearingBody, "complete"> {
  return {
    clearingAgentId: values.clearingAgentId,
    arrivedOn: values.arrivedOn,
    handedOn: dateOf(values.handedOn),
    billOfEntry: values.billOfEntry,
    dutyPaidOn: dateOf(values.dutyPaidOn),
    clearedOn: dateOf(values.clearedOn),
    goodsValueInr: values.goodsValueInr ? Number(values.goodsValueInr) : null,
    customsDutyInr: amountOf(values.customsDutyInr),
    otherDutiesInr: amountOf(values.otherDutiesInr),
    agentChargesInr: amountOf(values.agentChargesInr),
    portChargesInr: amountOf(values.portChargesInr),
  };
}

/** Clearing progress (25) from the saved clearing; arrival is done once the container has arrived. */
export function clearingSteps({ clearing: c, container, agents }: ClearingForm) {
  const total = c ? clearingTotal(CHARGES.map(({ key }) => ({ amount: c[key] }))) : 0;
  const agent = agents.find((a) => a.id === c?.clearingAgentId)?.name;
  const short = (day: string | null | undefined) => (day ? formatShortDate(day) : undefined);
  return progressSteps([
    { title: "Arrived at port", done: container.status === "arrived", detail: short(c?.arrivedOn) },
    { title: "Handed to clearing agent", done: !!c?.handedOn, detail: c?.handedOn ? `${short(c.handedOn)} · ${agent}` : undefined },
    { title: "Duty calculated", done: total > 0, detail: total > 0 ? formatINR(total) : undefined },
    { title: "Duty paid", done: !!c?.dutyPaidOn, detail: short(c?.dutyPaidOn) },
    { title: "Cleared from port", done: !!c?.clearedOn, detail: short(c?.clearedOn) },
    { title: "Handed over to transport", done: c?.status === "cleared", detail: c?.status === "cleared" ? short(c.clearedOn) : undefined },
  ]);
}
