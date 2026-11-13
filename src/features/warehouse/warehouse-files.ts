import { type Column, money, type ReportFile, type Section, summarySection } from "@/features/reports/report-files";
import type { WarehouseList, WarehouseListRow } from "@/lib/api/stages-types";

import { summarizeReceipts } from "./warehouse-logic";

// Warehouse and stock report download (backend docs/report-downloads.md): the stocked receipts the page's search,
// warehouse and team filters match, one row per order line with what was ordered, stocked on this receipt and so far,
// and what is still pending; each receipt's bundles (loaded against received) and the trip's short remark; the pieces
// per team; the stock by item and warehouse; and the trips waiting to be received. Only receipts into stock are
// recorded: there is no opening stock, issue or dispatch, so current stock is everything stocked so far.

const text = (header: string): Column => ({ header });
const date = (header: string): Column => ({ header, date: true });

type Line = NonNullable<WarehouseListRow["lines"]>[number];
/** The row's lines; an older backend sends none, so the main item with every piece of the row (ordered unknown). */
const linesOf = (row: WarehouseListRow): (Omit<Line, "ordered"> & { ordered: number | null })[] =>
  row.lines ?? [{ orderLineId: `${row.id}:main`, item: row.item, unit: "pcs", ordered: null, quantity: row.received }];

export function warehouseFile(
  rows: WarehouseListRow[],
  all: WarehouseListRow[],
  data: Pick<WarehouseList, "teams" | "ready">,
  options: { showCosts: boolean; filters: string; today: string },
): ReportFile {
  // Stocked so far per order line over every stocked receipt (not only the filtered ones): what is still pending.
  const stockedSoFar = new Map<string, number>();
  for (const row of all) for (const line of linesOf(row)) stockedSoFar.set(line.orderLineId, (stockedSoFar.get(line.orderLineId) ?? 0) + line.quantity);
  const totals = summarizeReceipts(rows);
  const stock = new Map<string, { warehouse: string; item: string; unit: string; quantity: number; receipts: Set<string> }>();
  for (const row of rows) {
    for (const line of linesOf(row)) {
      const key = `${row.location.id}|${line.item}|${line.unit}`;
      const entry = stock.get(key) ?? { warehouse: row.location.name, item: line.item, unit: line.unit, quantity: 0, receipts: new Set<string>() };
      entry.quantity += line.quantity;
      entry.receipts.add(row.receiptId);
      stock.set(key, entry);
    }
  }
  const teamSheet: Section = {
    sheet: "Team Split",
    title: "Pieces per team",
    columns: [date("Received on"), text("Warehouse"), text("PO"), text("Main item"), text("Received (pcs)"), ...data.teams.map((team) => text(team.name))],
    rows: rows.map((row) => [row.receivedOn, row.location.name, row.po, row.item, row.received, ...data.teams.map((team) => row.teams[team.id] ?? 0)]),
    total: rows.length ? ["Total", null, null, null, totals.received, ...data.teams.map((team) => totals.teams[team.id] ?? 0)] : undefined,
  };
  return {
    title: "Warehouse",
    filename: `warehouse-${options.today}`,
    filters: options.filters,
    notes: [
      "Only goods received into stock are recorded. Opening stock, issues and stock movements out of the warehouse are not tracked, so current stock is the stocked quantity.",
      "Pending = the order line's quantity less everything stocked for it so far, over every warehouse receipt.",
    ],
    sections: [
      summarySection([
        ["Receipt rows (order per receipt)", rows.length],
        ["Pieces stocked", totals.received],
        ...data.teams.map((team): [string, number] => [`${team.name} (pcs)`, totals.teams[team.id] ?? 0]),
        ...(options.showCosts ? [["Average landed cost per piece (INR)", totals.costPerPiece === null ? "–" : Math.round(totals.costPerPiece * 100) / 100] as [string, number | string]] : []),
        ["Trips waiting to be received", data.ready.length],
      ]),
      {
        sheet: "Received Items",
        title: "Received items",
        columns: [
          date("Received on"),
          text("Warehouse"),
          text("Container"),
          text("LR number"),
          text("PO"),
          text("Supplier"),
          text("Item"),
          text("Unit"),
          text("Ordered qty"),
          text("Stocked on this receipt"),
          text("Stocked so far"),
          text("Pending"),
          text("Bundles loaded"),
          text("Bundles received"),
          text("Bundles short"),
          text("Short remark"),
          text("Received by"),
          ...(options.showCosts ? [money("Landed cost per piece", "INR")] : []),
        ],
        rows: rows.flatMap((row) =>
          linesOf(row).map((line) => {
            const soFar = stockedSoFar.get(line.orderLineId) ?? 0;
            const loaded = row.bundlesLoaded ?? null;
            const received = row.bundlesReceived ?? null;
            return [
              row.receivedOn,
              row.location.name,
              row.container,
              row.lrNumber ?? null,
              row.po,
              row.supplier,
              line.item,
              line.unit,
              line.ordered,
              line.quantity,
              soFar,
              line.ordered === null ? null : Math.max(0, line.ordered - soFar),
              loaded,
              received,
              loaded === null || received === null ? null : Math.max(0, loaded - received),
              row.shortRemark || null,
              row.receivedBy,
              ...(options.showCosts ? [row.costPerPieceInr] : []),
            ];
          }),
        ),
      },
      teamSheet,
      {
        sheet: "Stock by Item",
        title: "Stock by item and warehouse",
        columns: [text("Warehouse"), text("Item"), text("Unit"), text("Current stock (stocked)"), text("Receipts")],
        rows: [...stock.values()]
          .sort((a, b) => a.warehouse.localeCompare(b.warehouse) || a.item.localeCompare(b.item))
          .map((entry) => [entry.warehouse, entry.item, entry.unit, entry.quantity, entry.receipts.size]),
      },
      {
        sheet: "Waiting to Receive",
        title: "Unloaded trips waiting to be received",
        columns: [text("Container"), text("Vehicle"), text("LR number"), date("Unloaded on"), text("Bundles received"), text("Destination"), text("Receipt"), text("POs")],
        rows: data.ready.map((trip) => [trip.container, trip.vehicleNumber, trip.lrNumber, trip.unloadedOn, trip.bundlesReceived, trip.destination, trip.receiptStatus === "draft" ? "Draft" : "Not started", trip.orders.join(", ")]),
      },
    ],
  };
}
