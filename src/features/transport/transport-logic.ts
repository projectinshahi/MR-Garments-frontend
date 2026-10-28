import { amountOf, amountText, dateOf, progressSteps } from "@/features/clearing/stage-form";
import type { SaveTripBody, TransportForm, TransportList, TripListRow } from "@/lib/api/stages-types";
import { formatNumber, formatShortDate } from "@/lib/formatters";

export const ALL = "all";

export type TransportState = "on-the-way" | "delivered";

export type TransportFilters = { query: string; company: string; state: TransportState | typeof ALL };

export const tripState = (row: Pick<TripListRow, "status">): TransportState => (row.status === "unloaded" ? "delivered" : "on-the-way");

/** Client-side list filtering: vehicle, LR, container or PO search, transport company (id) and the status chip. */
export function filterTransports(rows: TripListRow[], { query, company, state }: TransportFilters) {
  const q = query.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!q || [r.vehicleNumber, r.lrNumber, r.container, ...r.orders].some((value) => value.toLowerCase().includes(q))) &&
      (company === ALL || r.company.id === company) &&
      (state === ALL || tripState(r) === state),
  );
}

/** Totals row: "Total, 4 vehicles" and the summed transport cost. */
export function transportTotals(rows: Pick<TripListRow, "costInr">[]) {
  return {
    label: `Total, ${rows.length} ${rows.length === 1 ? "vehicle" : "vehicles"}`,
    cost: rows.reduce((sum, r) => sum + r.costInr, 0),
  };
}

/** KPI sub-lines (28): "no vehicle on the road", "all counts matched". */
export function kpiSubs(kpis: TransportList["kpis"]) {
  return {
    onTheWay: kpis.onTheWay ? `${kpis.onTheWay === 1 ? "vehicle" : "vehicles"} on the road` : "no vehicle on the road",
    bundles: kpis.shortLast30Days ? `${formatNumber(kpis.shortLast30Days)} short ${kpis.shortLast30Days === 1 ? "delivery" : "deliveries"}` : "all counts matched",
  };
}

/** Form values as typed: dates YYYY-MM-DD or "", counts and amounts as text. */
export type TripValues = Record<Exclude<keyof SaveTripBody, "complete">, string>;

/** TRN-3 fields shown on the form; any other field's message is toasted. */
export const TRIP_FIELDS = [
  "transportCompanyId",
  "destinationId",
  "lrNumber",
  "vehicleNumber",
  "driverName",
  "driverPhone",
  "bundlesLoaded",
  "loadedOn",
  "loadedFrom",
  "loadedBy",
  "unloadedOn",
  "bundlesReceived",
  "receivedBy",
  "shortRemark",
  "freightInr",
  "handlingInr",
] as const;

/** The saved trip, or a new one: the first company and warehouse, every bundle of the container, loaded today. */
export function tripValues({ trip, goods, companies, warehouses }: TransportForm, today: string): TripValues {
  const count = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));
  return {
    transportCompanyId: trip?.transportCompanyId ?? companies[0]?.id ?? "",
    destinationId: trip?.destinationId ?? warehouses[0]?.id ?? "",
    lrNumber: trip?.lrNumber ?? "",
    vehicleNumber: trip?.vehicleNumber ?? "",
    driverName: trip?.driverName ?? "",
    driverPhone: trip?.driverPhone ?? "",
    bundlesLoaded: count(trip ? trip.bundlesLoaded : goods.reduce((sum, line) => sum + line.bundles, 0)),
    loadedOn: trip?.loadedOn ?? today,
    loadedFrom: trip?.loadedFrom ?? "",
    loadedBy: trip?.loadedBy ?? "",
    unloadedOn: trip?.unloadedOn ?? "",
    bundlesReceived: count(trip?.bundlesReceived),
    receivedBy: trip?.receivedBy ?? "",
    shortRemark: trip?.shortRemark ?? "",
    freightInr: amountText(trip?.freightInr),
    handlingInr: amountText(trip?.handlingInr),
  };
}

const countOf = (value: string) => (value === "" ? null : Number(value));

export function toTripBody(values: TripValues): Omit<SaveTripBody, "complete"> {
  return {
    ...values,
    bundlesLoaded: Number(values.bundlesLoaded),
    unloadedOn: dateOf(values.unloadedOn),
    bundlesReceived: countOf(values.bundlesReceived),
    freightInr: amountOf(values.freightInr),
    handlingInr: amountOf(values.handlingInr),
  };
}

/** Screen 27's rule: fewer bundles received than loaded needs a short remark. */
export const isShort = (values: Pick<TripValues, "bundlesLoaded" | "bundlesReceived">) =>
  values.bundlesReceived !== "" && Number(values.bundlesReceived) < Number(values.bundlesLoaded);

/** Transport progress (27) from the saved clearing and trip. */
export function transportSteps({ clearing, trip }: TransportForm) {
  const cleared = clearing?.status === "cleared";
  const unloaded = trip?.status === "unloaded";
  return progressSteps([
    {
      title: "Cleared, handed to transport",
      done: cleared,
      detail: cleared && clearing.clearedOn ? `${formatShortDate(clearing.clearedOn)} · from ${clearing.agent.name}` : undefined,
    },
    { title: "Loaded on vehicle", done: !!trip, detail: trip ? `${formatShortDate(trip.loadedOn)} · ${trip.vehicleNumber}` : undefined },
    { title: "On the way to warehouse", done: unloaded, detail: trip?.lrNumber },
    {
      title: "Unloaded at our warehouse",
      done: unloaded,
      detail: unloaded ? `${formatShortDate(trip.unloadedOn!)} · ${trip.bundlesReceived} of ${trip.bundlesLoaded} bundles` : undefined,
    },
  ]);
}
