import { type Column, money, type ReportFile, summarySection } from "@/features/reports/report-files";
import type { TransportList, TripListRow } from "@/lib/api/stages-types";

// Transport report download (backend docs/report-downloads.md): every trip the page's search, company and status
// filters match, with its container and POs, vehicle, LR, dispatch (loaded) and arrival (unloaded) dates, the warehouse
// it went to, the goods it carried per unit, the bundles loaded and received, and its cost apart (TRN-3's freight and
// loading/unloading, INR); then the cleared containers still waiting for a vehicle.

const text = (header: string): Column => ({ header });
const date = (header: string): Column => ({ header, date: true });
const inr = (header: string) => money(header, "INR");
const sum = (rows: TripListRow[], pick: (row: TripListRow) => number | undefined) => Math.round(rows.reduce((total, row) => total + (pick(row) ?? 0), 0) * 100) / 100;
/** "100 pcs · 40 m": quantities per unit are never added together. */
const goods = (quantities: TripListRow["quantities"]) => (quantities?.length ? quantities.map((q) => `${q.quantity} ${q.unit}`).join(" · ") : null);

export function transportFile(rows: TripListRow[], data: Pick<TransportList, "kpis" | "ready">, filters: string, today: string): ReportFile {
  return {
    title: "Transport",
    filename: `transport-${today}`,
    filters,
    notes: ["Costs are per trip in INR and are not split between the trip's POs. Quantities are per unit (pieces and metres are never added)."],
    sections: [
      summarySection([
        ["Trips", rows.length],
        ["On the way", rows.filter((row) => row.status === "on_road").length],
        ["Delivered", rows.filter((row) => row.status === "unloaded").length],
        ["Bundles loaded", rows.reduce((total, row) => total + row.bundlesLoaded, 0)],
        ["Bundles received", rows.reduce((total, row) => total + (row.bundlesReceived ?? 0), 0)],
        ["Transport cost (INR)", sum(rows, (row) => row.costInr)],
        ["Delivered, last 30 days", data.kpis.deliveredLast30Days],
        ["Transport cost, last 30 days (INR)", data.kpis.transportCostLast30DaysInr],
        ["Cleared containers waiting for a vehicle", data.ready.length],
      ]),
      {
        sheet: "Trips",
        title: "Trips",
        columns: [
          text("Container"),
          text("POs"),
          text("Transport company"),
          text("Vehicle number"),
          text("LR number"),
          text("Driver"),
          date("Dispatch date (loaded)"),
          date("Arrival date (unloaded)"),
          text("Warehouse destination"),
          text("Quantity transported"),
          text("Bundles loaded"),
          text("Bundles received"),
          text("Status"),
          inr("Freight"),
          inr("Loading and unloading"),
          inr("Transport cost"),
          text("Short remark"),
        ],
        rows: rows.map((row) => [
          row.container,
          row.orders.join(", "),
          row.company.name,
          row.vehicleNumber,
          row.lrNumber,
          row.driverName || null,
          row.loadedOn,
          row.unloadedOn,
          row.destination ?? null,
          goods(row.quantities),
          row.bundlesLoaded,
          row.bundlesReceived,
          row.status === "unloaded" ? "Delivered" : "On the way",
          row.freightInr ?? null,
          row.handlingInr ?? null,
          row.costInr,
          row.shortRemark || null,
        ]),
        total: rows.length
          ? [`Total, ${rows.length} trips`, ...Array<null>(12).fill(null), sum(rows, (row) => row.freightInr), sum(rows, (row) => row.handlingInr), sum(rows, (row) => row.costInr), null]
          : undefined,
      },
      {
        sheet: "Waiting for Vehicle",
        title: "Cleared, waiting for a vehicle",
        columns: [text("Container"), text("POs"), date("Cleared on"), text("Clearing agent"), text("Bundles")],
        rows: data.ready.map((row) => [row.container, row.orders.join(", "), row.clearedOn, row.clearingAgent, row.bundles]),
      },
    ],
  };
}
