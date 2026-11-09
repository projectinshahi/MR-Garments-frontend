import { CONTAINER_STATUS } from "@/features/containers/containers-logic";
import type { OrderReport, OrderTimelineStep } from "@/lib/api/reports-types";
import { formatDate } from "@/lib/formatters";
import { STAGES } from "@/types/domain";

import { type Column, money, type ReportFile, type Section } from "../report-files";

// The Excel and PDF of an order's Report tab (RPT-O1, backend docs/phase2-contracts.md 4.3): the sections the API gave
// (a nulled section is left out), on the sheets Order Summary, Items, Payments, Logistics, Warehouse, Landed Cost and
// Timeline. The overview and the landed cost are two-column Field/Value tables, so amounts there name their currency
// in the field.

const date = (header: string): Column => ({ header, date: true });
const columns = (...list: (string | Column)[]) => list.map((column) => (typeof column === "string" ? { header: column } : column));
const orDash = (value: string | null) => (value?.trim() ? value : "–");

/** What each timeline step is called on the tab and in the files. */
export const TIMELINE_LABEL: Record<OrderTimelineStep["step"], string> = {
  created: "Order placed",
  deposit: "Deposit paid",
  payment: "Payment made",
  received: "Received in China",
  loaded: "Container loaded",
  sailed: "Sailed",
  arrived: "Arrived at port",
  cleared: "Cleared customs",
  dispatched: "On the road",
  unloaded: "Unloaded",
  stocked: "Stocked in warehouse",
  closed: "Order closed",
};

export const stageLabel = (stage: number) => `${stage}. ${STAGES[stage - 1]}`;
export const closureLabel = (order: Pick<OrderReport["order"], "closed" | "closedOn">) => (order.closed && order.closedOn ? `Closed on ${formatDate(order.closedOn)}` : "Open");
/** "Estimate, waiting for duty" or "Final". */
export const costStatus = (cost: NonNullable<OrderReport["landedCost"]>) => (cost.final ? "Final" : `Estimate, waiting for ${cost.waitingFor}`);

/** The report's file, named `order-report-<PO>-<today>` (a PO's slashes become dashes). */
export function orderReportFile(report: OrderReport, today: string): ReportFile {
  const { order, lines, payments, logistics, warehouse, landedCost, timeline } = report;
  const cur = order.currency;
  const sections: Section[] = [
    {
      sheet: "Order Summary",
      title: "Overview",
      columns: columns("Field", "Value"),
      rows: [
        ["PO", order.po],
        ["Supplier", order.supplier.name],
        ["Contact", orDash(order.supplier.contactPerson)],
        ["Phone", orDash(order.supplier.phone)],
        ["City", orDash(order.supplier.city)],
        ["Order date", formatDate(order.orderDate)],
        ["Delivery date", formatDate(order.deliveryDate)],
        ["Stage", stageLabel(order.stage)],
        ["Status", closureLabel(order)],
        ["Currency", cur],
        [`Order value (${cur})`, order.orderValueCny],
      ],
    },
    {
      sheet: "Order Summary",
      title: "Quantities",
      columns: columns("Unit", "Ordered", "Received", "Stocked"),
      rows: order.totals.map((total) => [total.unit, total.ordered, total.received, total.stocked]),
    },
    {
      sheet: "Items",
      title: "Items",
      columns: columns("#", "Item", "Unit", "Ordered", "Received", "Excess", "Short", "Loaded", "Stocked", money("Rate", cur), money("Value", cur)),
      rows: lines.map((line) => [line.position + 1, line.item, line.unit, line.ordered, line.received, line.excess, line.short, line.loaded, line.stocked, line.rateCny, line.valueCny]),
      total: ["", "Total", "", "", "", "", "", "", "", "", order.orderValueCny],
    },
  ];
  if (payments) {
    sections.push(
      {
        sheet: "Payments",
        title: "Supplier payments",
        columns: columns("Field", "Value"),
        rows: [
          [`Paid to supplier (${cur})`, payments.paidCny],
          ["Paid (INR)", payments.paidInr],
          [`Balance (${cur})`, payments.balanceCny],
          [`Deposits paid (${cur})`, payments.depositsPaidCny],
          [`Due (${cur})`, payments.dueCny],
        ],
      },
      {
        sheet: "Payments",
        title: "Payments",
        columns: columns("Type", "Payee", "Paid to", money("Amount", cur), "Rate (INR)", money("Amount", "INR"), "Status", date("Paid on"), date("Due date"), "Mode", "Reference", "Notes"),
        rows: payments.list.map((p) => [p.kind, p.payee, p.payeeRole, p.amountCny, p.rateInr, p.amountInr, p.status, p.paidOn, p.dueDate, p.mode, p.reference, p.notes]),
      },
    );
  }
  if (logistics) {
    sections.push(
      {
        sheet: "Logistics",
        title: "Containers",
        columns: columns("Container", "Status", "Terms", "Agent", "Port of loading", "Port of arrival", date("Loaded"), date("Sailed"), date("ETA"), "This order's goods"),
        rows: logistics.map((c) => [
          c.number,
          CONTAINER_STATUS[c.status].label,
          c.terms,
          c.agent,
          c.portOfLoading,
          c.portOfArrival,
          c.loadedOn,
          c.sailedOn,
          c.eta,
          c.lines.map((line) => `${line.item}: ${line.quantity} ${line.unit}`).join(", "),
        ]),
      },
      {
        sheet: "Logistics",
        title: "Clearing (container totals)",
        columns: columns(
          "Container",
          "Agent",
          date("Arrived"),
          date("Handed over"),
          "Bill of entry",
          date("Duty paid"),
          date("Cleared"),
          "Status",
          money("Customs duty", "INR"),
          money("Other duties", "INR"),
          money("Agent charges", "INR"),
          money("Port charges", "INR"),
          money("Total", "INR"),
        ),
        rows: logistics.flatMap((c) =>
          c.clearing
            ? [
                [
                  c.number,
                  c.clearing.agent,
                  c.clearing.arrivedOn,
                  c.clearing.handedOn,
                  c.clearing.billOfEntry,
                  c.clearing.dutyPaidOn,
                  c.clearing.clearedOn,
                  c.clearing.status === "cleared" ? "Cleared" : "In clearing",
                  c.clearing.customsDutyInr,
                  c.clearing.otherDutiesInr,
                  c.clearing.agentChargesInr,
                  c.clearing.portChargesInr,
                  c.clearing.totalInr,
                ],
              ]
            : [],
        ),
      },
      {
        sheet: "Logistics",
        title: "Transport (container totals)",
        columns: columns("Container", "Company", "LR number", "Vehicle", "Driver", "Destination", date("Loaded"), date("Unloaded"), "Bundles loaded", "Bundles received", "Status", money("Freight", "INR"), money("Handling", "INR"), money("Total", "INR")),
        rows: logistics.flatMap((c) =>
          c.transport
            ? [
                [
                  c.number,
                  c.transport.company,
                  c.transport.lrNumber,
                  c.transport.vehicleNumber,
                  c.transport.driverName,
                  c.transport.destination,
                  c.transport.loadedOn,
                  c.transport.unloadedOn,
                  c.transport.bundlesLoaded,
                  c.transport.bundlesReceived,
                  c.transport.status === "unloaded" ? "Unloaded" : "On the road",
                  c.transport.freightInr,
                  c.transport.handlingInr,
                  c.transport.totalInr,
                ],
              ]
            : [],
        ),
      },
    );
  }
  if (warehouse) {
    sections.push({
      sheet: "Warehouse",
      title: "Warehouse receipts",
      columns: columns("Container", "Warehouse", date("Received"), "Received by", "Status", "Bundles", "Item", "Unit", "Team", "Quantity"),
      rows: warehouse.flatMap((r) => {
        const head = [r.container, r.warehouse, r.receivedOn, r.receivedBy, r.status === "stocked" ? "Stocked" : "Draft", r.bundlesReceived];
        return r.lines.length ? r.lines.map((line) => [...head, line.item, line.unit, line.team, line.quantity]) : [[...head, null, null, null, null]];
      }),
    });
  }
  if (landedCost) {
    sections.push({
      sheet: "Landed Cost",
      title: "Landed cost",
      columns: columns("Field", "Value"),
      rows: [
        ["Goods (INR)", landedCost.goodsInr],
        ["Sea freight (INR)", landedCost.seaFreightInr],
        ["Clearing (INR)", landedCost.clearingInr],
        ["Transport (INR)", landedCost.transportInr],
        ["Total (INR)", landedCost.totalInr],
        ["Stocked pieces", landedCost.stockedPieces],
        ["Per piece (INR)", landedCost.perPieceInr],
        ["Status", costStatus(landedCost)],
      ],
    });
  }
  sections.push({
    sheet: "Timeline",
    title: "Timeline",
    columns: columns("Step", date("Date"), "Detail"),
    rows: timeline.map((step) => [TIMELINE_LABEL[step.step], step.on, step.detail]),
  });
  return {
    title: `Order report ${order.po}`,
    filename: `order-report-${order.po.replace(/[^\w-]+/g, "-")}-${today}`,
    filters: `Supplier: ${order.supplier.name} · Ordered ${formatDate(order.orderDate)} · ${stageLabel(order.stage)} · ${closureLabel(order)}`,
    sections,
  };
}
