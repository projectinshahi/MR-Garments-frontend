import { CONTAINER_STATUS } from "@/features/containers/containers-logic";
import { stageLabel } from "@/features/orders/order-status";
import { balanceText, HELD_BALANCE, MILESTONE_STATUS, PAYMENT_STATUS, paymentType, round2 } from "@/features/payments/money";
import { ledgerSections } from "@/features/supplier-ledger/ledger-files";
import type { LedgerAccount } from "@/lib/api/ledger-types";
import type { OrderReport, OrderTimelineStep } from "@/lib/api/reports-types";
import type { SettlementFields } from "@/lib/api/types";
import { formatDate, formatDateTime } from "@/lib/formatters";
import type { MoneyTotal } from "@/types/domain";

import { type Cell, type Column, money, type ReportFile, type Section } from "../report-files";

// The Excel, PDF and CSV of an order's comprehensive report (RPT-O1, backend docs/order-report.md): the sections the
// API gave (a nulled section is left out), one Excel sheet per section: Order Overview, Supplier Details, Order Items,
// China Receiving, Shipping, Customs, Warehouse, Payment History, Deposit History, Landed Cost and Order Timeline. The
// PDF and CSV hold every table in that order. Field/Value tables name their currency in the field.

const date = (header: string): Column => ({ header, date: true });
const columns = (...list: (string | Column)[]) => list.map((column) => (typeof column === "string" ? { header: column } : column));
const orDash = (value: string | null | undefined) => (value?.trim() ? value : "–");
const when = (value: string | null) => (value ? formatDateTime(value) : "–");
const moneyList = (totals: MoneyTotal[]) => (totals.length ? totals.map((total) => `${total.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${total.currency}`).join(" · ") : "–");

/** The order's FIFO payment status as the page and files write it: "Pending review" while its account is held, "–" when not posted. */
export const settlementLabel = (s: Pick<SettlementFields, "held" | "paymentStatus">) => (s.held ? HELD_BALANCE : s.paymentStatus ? PAYMENT_STATUS[s.paymentStatus].label : "–");
/** The supplier's signed ledger balance per currency ("Payable to supplier ¥1,200.00 · Settled"); a held one says so. */
export const accountsText = (accounts: LedgerAccount[]) =>
  accounts.map((a) => `${a.currency}: ${a.held || a.balanceCny === null ? HELD_BALANCE : balanceText(a.balanceCny, a.currency)}`).join(" · ") || "–";

/** The report's sections, in page and file order, with the ids the section navigation scrolls to. */
export const REPORT_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "supplier", label: "Supplier" },
  { id: "items", label: "Items" },
  { id: "china", label: "China Processing" },
  { id: "shipping", label: "Shipping" },
  { id: "customs", label: "Customs" },
  { id: "warehouse", label: "Warehouse" },
  { id: "payments", label: "Payments" },
  { id: "deposits", label: "Deposits" },
  { id: "landed-cost", label: "Landed Cost" },
  { id: "timeline", label: "Timeline" },
  { id: "documents", label: "Documents" },
] as const;

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

/** A container's state for the report: its trip and clearing say more than the container's own status once it has arrived. */
export const containerState = (c: Pick<NonNullable<OrderReport["logistics"]>[number], "status" | "clearing" | "transport">) =>
  c.transport?.status === "unloaded" ? "Unloaded" : c.transport ? "On the road" : c.clearing?.status === "cleared" ? "Cleared" : CONTAINER_STATUS[c.status].label;
export { stageLabel };
export const closureLabel = (order: Pick<OrderReport["order"], "closed" | "closedOn">) => (order.closed && order.closedOn ? `Closed on ${formatDate(order.closedOn)}` : "Open");
/** "Estimate, waiting for duty" or "Final". */
export const costStatus = (cost: NonNullable<OrderReport["landedCost"]>) => (cost.final ? "Final" : `Estimate, waiting for ${cost.waitingFor}`);

export type CostComponentStatus = "recorded" | "partial" | "missing" | "not applicable" | "not tracked";
export type CostComponent = { label: string; inr: number | null; status: CostComponentStatus };

/**
 * The landed cost as a component list (the existing engine's figures, nothing recomputed): the parts the records hold,
 * the goods while part of the order is still unpaid (`partial`), the parts still missing (an estimate), and the parts
 * this system never records. Sea freight is what the agent payments hold, 0 included (the engine never waits for it);
 * on CNF terms it does not apply. `additionalInr` is everything but the goods.
 */
export function landedCostBreakdown(cost: NonNullable<OrderReport["landedCost"]>, logistics: OrderReport["logistics"]) {
  const carriers = logistics ?? [];
  const cnf = carriers.length > 0 && carriers.every((container) => container.terms === "CNF");
  const notTracked = (label: string): CostComponent => ({ label, inr: null, status: "not tracked" });
  const components: CostComponent[] = [
    {
      label: "Original purchase value (the supplier payments that settled the order, INR at each one's own rate)",
      inr: cost.goodsInr,
      status: cost.waitingFor === "supplier payment" ? "partial" : "recorded",
    },
    notTracked("Supplier-side charges"),
    notTracked("China receiving charges"),
    notTracked("China transportation charges"),
    { label: "International sea freight (payments to shipping agents)", inr: cost.seaFreightInr, status: cnf ? "not applicable" : "recorded" },
    notTracked("Insurance"),
    { label: "Customs duty, other duties, agent and port charges (allocated share)", inr: cost.clearingInr, status: cost.clearingInr === null ? "missing" : "recorded" },
    notTracked("GST and other taxes (apart from recorded duties)"),
    { label: "India transportation: freight, loading and unloading (allocated share)", inr: cost.transportInr, status: cost.transportInr === null ? "missing" : "recorded" },
    notTracked("Warehouse receiving charges"),
    notTracked("Other recorded expenses and adjustments"),
  ];
  const additionalInr = Math.round((cost.seaFreightInr + (cost.clearingInr ?? 0) + (cost.transportInr ?? 0)) * 100) / 100;
  return { components, additionalInr };
}

const STATUS_LABEL: Record<CostComponentStatus, string> = {
  recorded: "Recorded",
  partial: "Partly paid (balance outstanding)",
  missing: "Missing",
  "not applicable": "Not applicable",
  "not tracked": "Not recorded in this system",
};

/** The report's file, named `order-report-<PO>-<today>` (a PO's slashes become dashes). */
export function orderReportFile(report: OrderReport, today: string): ReportFile {
  const { order, lines, payments, supplierAccount, receipts, logistics, warehouse, landedCost, timeline } = report;
  const cur = order.currency;
  const supplier = order.supplier;
  const perUnit = (pick: (total: OrderReport["order"]["totals"][number]) => number) => order.totals.map((total) => `${pick(total)} ${total.unit}`).join(" · ") || "–";
  const sections: Section[] = [
    {
      sheet: "Order Overview",
      title: "Overview",
      columns: columns("Field", "Value"),
      rows: [
        ["PO number", order.po],
        ["Order ID", order.id],
        ["Created", when(order.createdAt)],
        ["Created by", orDash(order.createdBy)],
        ["Last updated", when(order.updatedAt)],
        ["Order date", formatDate(order.orderDate)],
        ["Delivery date", formatDate(order.deliveryDate)],
        ["Supplier", `${supplier.name}${supplier.code ? ` (${supplier.code})` : ""}`],
        ["Stage", stageLabel(order.stage)],
        ["Status", closureLabel(order)],
        ["Currency", cur],
        [`Exchange rate on this PO (INR per 1 ${cur})`, order.exchangeRate],
        ["Products", order.products],
        [`PO value (${cur}, ordered quantity x rate)`, order.poValueCny],
        [`Order value (${cur}, received quantity x rate)`, order.orderValueCny],
        ["Order value (INR, at the PO rate)", order.orderValueInr],
        ...(payments
          ? ([
              [`Settled from the supplier's account (${cur})`, payments.settledCny],
              ["Settled (INR, at each payment's rate)", payments.settledInr],
              [`Outstanding (${cur})`, payments.outstandingCny],
              ["Payment status", settlementLabel(payments)],
            ] as Cell[][])
          : []),
        ["Ordered", perUnit((t) => t.ordered)],
        ["Received in China", perUnit((t) => t.received)],
        ["Pending", perUnit((t) => t.pending)],
        ["Stocked in warehouse", perUnit((t) => t.stocked)],
      ],
    },
    {
      sheet: "Order Overview",
      title: "Quantities",
      columns: columns("Unit", "Ordered", "Received", "Pending", "Stocked"),
      rows: order.totals.map((total) => [total.unit, total.ordered, total.received, total.pending, total.stocked]),
    },
    {
      sheet: "Supplier Details",
      title: "Supplier",
      columns: columns("Field", "Value"),
      rows: [
        ["Supplier code", orDash(supplier.code)],
        ["Supplier name", supplier.name],
        ["Country", orDash(supplier.country)],
        ["Status", supplier.status],
        ["Contact person", orDash(supplier.contactPerson)],
        ["Email", orDash(supplier.email)],
        ["Phone", orDash(supplier.phone)],
        ["Address", orDash(supplier.address)],
        ["City", orDash(supplier.city)],
        ["State / Province", orDash(supplier.state)],
        ["Postal code", orDash(supplier.postalCode)],
        ["Payment terms", orDash(supplier.paymentTerms)],
        ["Supplier currency", supplier.currency],
        ["Exchange rate now (INR per 1 unit)", supplier.exchangeRate],
        ["Rate last updated", when(supplier.rateUpdatedAt)],
        ["Tax / registration number", orDash(supplier.taxNumber)],
        ["Notes", orDash(supplier.notes)],
      ],
    },
  ];
  if (payments && supplierAccount) {
    sections.push({
      sheet: "Supplier Details",
      title: "Supplier financial summary",
      columns: columns("Field", "Value"),
      rows: [
        ["Orders with this supplier", supplierAccount.orders],
        ["Open orders with this supplier", supplierAccount.openOrders],
        ["Total purchase value with this supplier", moneyList(supplierAccount.purchaseValue)],
        ["Settled (every order)", moneyList(supplierAccount.settled)],
        ["Outstanding (every order)", moneyList(supplierAccount.outstanding)],
        ["Supplier balance (ledger)", accountsText(supplierAccount.accounts)],
        [`Settled for this PO (${cur})`, payments.settledCny],
        [`Outstanding for this PO (${cur})`, payments.outstandingCny],
        ...supplierAccount.deposits.summary.map(
          (line): Cell[] => [
            `Supplier deposit ${line.direction === "give" ? "to give" : "to receive"} (${line.currency}): agreed · settled · remaining`,
            `${line.amount} · ${line.settled} · ${line.pending}`,
          ],
        ),
        ["Deposit utilised for this PO", "Not tracked: account deposits are not linked to orders"],
      ],
    });
    // The supplier's ledger accounts and statement (newest first), beside the summary.
    sections.push(...ledgerSections(supplierAccount.accounts, supplierAccount.entries).map((s) => ({ ...s, sheet: "Supplier Details", title: s.title === "Accounts" ? "Supplier ledger accounts" : s.title })));
  }
  sections.push({
    sheet: "Order Items",
    title: "Items",
    columns: columns("Sl. No.", "Item code", "Item", "Unit", "Quantity", "Received", "Pending", "Excess", "Loaded", "Stocked", money("Rate", cur), money("PO amount (ordered)", cur), money("Amount (received)", cur)),
    rows: lines.map((line) => [line.position + 1, null, line.item, line.unit, line.ordered, line.received, line.pending, line.excess, line.loaded, line.stocked, line.rateCny, line.poValueCny, line.valueCny]),
    total: ["", "", `${order.products} item${order.products === 1 ? "" : "s"}`, "", perUnit((t) => t.ordered), perUnit((t) => t.received), perUnit((t) => t.pending), "", "", perUnit((t) => t.stocked), "", order.poValueCny, order.orderValueCny],
  });
  if (receipts) {
    sections.push({
      sheet: "China Receiving",
      title: "China receipts",
      columns: columns("Receipt", date("Received"), "Office", "Received by", "Bundles", "Delivery note", "Shortage remark", "Recorded", "Item", "Unit", "Quantity"),
      rows: receipts.flatMap((receipt, index) => {
        const head: Cell[] = [index + 1, receipt.receivedOn, receipt.office, receipt.receivedBy, receipt.bundles, receipt.deliveryNote, receipt.shortRemark, when(receipt.recordedAt)];
        return receipt.lines.length ? receipt.lines.map((line) => [...head, line.item, line.unit, line.quantity]) : [[...head, null, null, null]];
      }),
    });
  }
  if (logistics) {
    sections.push({
      sheet: "Shipping",
      title: "Containers",
      columns: columns("Container", "Status", "Terms", "Shipping agent", "Port of loading", "Destination port", date("Loaded"), date("Departed"), date("Estimated arrival"), "ETA estimated", date("Actual arrival"), "This order's goods", "Recorded by", "Recorded"),
      rows: logistics.map((c) => [
        c.number,
        containerState(c),
        c.terms,
        c.agent,
        c.portOfLoading,
        c.portOfArrival,
        c.loadedOn,
        c.sailedOn,
        c.eta,
        c.etaEstimated ? "Yes" : "No",
        c.clearing?.arrivedOn ?? null,
        c.lines.map((line) => `${line.item}: ${line.quantity} ${line.unit} (${line.bundles} bundles)`).join(", "),
        orDash(c.recordedBy),
        when(c.recordedAt),
      ]),
    });
    if (payments) {
      // Paid rows only: the total is what was paid; a due agent payment stays in the payment ledger.
      const agentPayments = payments.list.filter((p) => p.payeeRole === "agent" && p.status === "paid" && !p.voided);
      sections.push({
        sheet: "Shipping",
        title: "Sea freight paid to shipping agents",
        columns: columns(date("Paid on"), date("Due date"), "Agent", "Reference", money("Amount", cur), "Rate (INR)", money("Amount", "INR"), "Status", "Notes"),
        rows: agentPayments.map((p) => [p.paidOn, p.dueDate, p.payee, p.reference, p.amountCny, p.rateInr, p.amountInr, p.held ? "pending review" : p.status, p.notes]),
        // null, not "", under the date columns: the PDF formats a date column's text as a date.
        total: agentPayments.length ? [null, null, "Sea freight paid", "", payments.agentPaidCny, null, payments.agentPaidInr, "", ""] : undefined,
      });
    }
    sections.push(
      {
        sheet: "Customs",
        title: "Clearing (container totals)",
        columns: columns(
          "Container",
          "Clearing agent",
          date("Arrived"),
          date("Handed over"),
          "Bill of entry",
          date("Duty paid"),
          date("Cleared"),
          "Status",
          money("Goods value (information)", "INR"),
          money("Customs duty", "INR"),
          money("Other duties and taxes", "INR"),
          money("Agent charges", "INR"),
          money("Port charges", "INR"),
          money("Total", "INR"),
          "Recorded by",
          "Recorded",
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
                  c.clearing.goodsValueInr,
                  c.clearing.customsDutyInr,
                  c.clearing.otherDutiesInr,
                  c.clearing.agentChargesInr,
                  c.clearing.portChargesInr,
                  c.clearing.totalInr,
                  orDash(c.clearing.recordedBy),
                  when(c.clearing.recordedAt),
                ],
              ]
            : [[c.number, "No clearing recorded", null, null, null, null, null, null, null, null, null, null, null, null, null, null]],
        ),
      },
      {
        sheet: "Warehouse",
        title: "Transport (container totals)",
        columns: columns(
          "Container",
          "Transport company",
          "LR number",
          "Vehicle",
          "Driver",
          "Driver phone",
          "Loaded from",
          "Loaded by",
          "Destination",
          date("Dispatched"),
          date("Arrived"),
          "Bundles loaded",
          "Bundles received",
          "Received by",
          "Shortage remark",
          "Status",
          money("Freight", "INR"),
          money("Loading and unloading", "INR"),
          money("Total", "INR"),
          "Recorded by",
        ),
        rows: logistics.flatMap((c) =>
          c.transport
            ? [
                [
                  c.number,
                  c.transport.company,
                  c.transport.lrNumber,
                  c.transport.vehicleNumber,
                  c.transport.driverName,
                  c.transport.driverPhone,
                  c.transport.loadedFrom,
                  c.transport.loadedBy,
                  c.transport.destination,
                  c.transport.loadedOn,
                  c.transport.unloadedOn,
                  c.transport.bundlesLoaded,
                  c.transport.bundlesReceived,
                  c.transport.receivedBy,
                  c.transport.shortRemark,
                  c.transport.status === "unloaded" ? "Unloaded" : "On the road",
                  c.transport.freightInr,
                  c.transport.handlingInr,
                  c.transport.totalInr,
                  orDash(c.transport.recordedBy),
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
      columns: columns("Container", "Warehouse", date("Received"), "Received by", "Status", "Bundles", "Item", "Unit", "Team", "Quantity", "Recorded by", "Recorded"),
      rows: warehouse.flatMap((r) => {
        const head: Cell[] = [r.container, r.warehouse, r.receivedOn, r.receivedBy, r.status === "stocked" ? "Stocked" : "Draft", r.bundlesReceived];
        const tail: Cell[] = [orDash(r.recordedBy), when(r.recordedAt)];
        return r.lines.length ? r.lines.map((line) => [...head, line.item, line.unit, line.team, line.quantity, ...tail]) : [[...head, null, null, null, null, ...tail]];
      }),
    });
  }
  if (payments) {
    sections.push(
      {
        sheet: "Payment History",
        title: "Payment summary",
        columns: columns("Field", "Value"),
        rows: [
          [`Original PO amount (${cur})`, order.orderValueCny],
          [`Settled from the supplier's account (${cur})`, payments.settledCny],
          ["Settled (INR, at each payment's rate)", payments.settledInr],
          [`Outstanding (${cur})`, payments.outstandingCny],
          ["Payment status", settlementLabel(payments)],
          [`Due (${cur})`, payments.dueCny],
          [`Sea freight paid to agents (${cur})`, payments.agentPaidCny],
          ["Sea freight paid (INR)", payments.agentPaidInr],
          // The Deposit Required milestone (D11), only when one was agreed: met once the settled amount reaches it.
          ...(payments.depositRequiredCny == null
            ? []
            : ([
                [`Deposit required (${cur})`, payments.depositRequiredCny],
                [`Deposit pending (${cur})`, payments.depositPendingCny],
                ["Deposit milestone", payments.depositStatus ? MILESTONE_STATUS[payments.depositStatus].label : null],
              ] as Cell[][])),
          ["Refunds and corrections", "Voids and Management adjustments on the supplier ledger (the statement on Supplier Details)"],
        ],
      },
      {
        sheet: "Payment History",
        title: "Settled by (supplier credits, oldest first)",
        columns: columns(date("Date"), "Credit", "Reference", "Method", "Recorded against PO", money("Amount", cur), "Rate (INR)", money("Amount", "INR")),
        rows: payments.slices.map((s) => [s.entryDate, s.entryType === "adjustment" ? "Adjustment" : "Payment", s.reference, s.mode, s.memoPo, s.amount, s.exchangeRate, s.amountInr]),
        total: payments.slices.length ? [null, "Settled", null, null, null, payments.settledCny, null, payments.settledInr] : undefined,
      },
      {
        sheet: "Payment History",
        title: "Payments recorded on this PO",
        columns: columns(date("Payment date"), "Reference", "Type", "Method", money("Amount", cur), "Currency", "Rate (INR)", money("Amount", "INR"), "Payee", "Paid to", "Notes", "Status", date("Due date"), "Recorded by", "Recorded"),
        rows: payments.list.map((p) => [
          p.paidOn,
          p.reference,
          paymentType(p),
          p.mode,
          p.amountCny,
          p.currency,
          p.rateInr,
          p.amountInr,
          p.payee,
          p.payeeRole,
          p.notes,
          p.voided ? `voided: ${p.voidReason}` : p.held ? "pending review" : p.status,
          p.dueDate,
          orDash(p.recordedBy),
          when(p.recordedAt),
        ]),
      },
    );
  }
  if (payments && supplierAccount) {
    // Legacy supplier deposits recorded against this PO (a memo: they settle through the account); paid, not voided.
    const poDeposits = payments.list.filter((p) => p.payeeRole === "supplier" && p.kind === "Deposit" && p.status === "paid" && !p.voided);
    sections.push(
      {
        sheet: "Deposit History",
        title: "Legacy deposits recorded against this PO",
        columns: columns(date("Paid on"), date("Due date"), "Reference", money("Amount", cur), "Rate (INR)", money("Amount", "INR"), "Mode", "Status", "Notes"),
        rows: poDeposits.map((p) => [p.paidOn, p.dueDate, p.reference, p.amountCny, p.rateInr, p.amountInr, p.mode, p.held ? "pending review" : p.status, p.notes]),
        // A held account's deposits (D4) are listed as records and count in no total.
        total: poDeposits.length ? [null, null, "Deposits", payments.held ? null : round2(poDeposits.reduce((sum, p) => sum + p.amountCny, 0)), null, null, "", "", ""] : undefined,
      },
      {
        sheet: "Deposit History",
        title: "Supplier account deposits (not linked to this PO)",
        columns: columns("Reference", "Direction", date("Agreed"), "Currency", "Rate (INR)", "Amount", "Settled", "Remaining", "Status", "Applied to this PO", "Notes", date("Transaction date"), "Transaction reference", "Mode", "Transaction amount", "Transaction notes"),
        rows: supplierAccount.deposits.list.flatMap((d) => {
          const head: Cell[] = [d.reference, d.direction === "give" ? "To give" : "To receive", d.openedOn, d.currency, d.exchangeRate, d.amount, d.settled, d.pending, d.status, "Not tracked", d.notes];
          return d.transactions.length ? d.transactions.map((t) => [...head, t.paidOn, t.reference, t.mode, t.amount, t.notes]) : [[...head, null, null, null, null, null]];
        }),
      },
    );
  }
  if (landedCost) {
    const { components, additionalInr } = landedCostBreakdown(landedCost, logistics);
    sections.push(
      {
        sheet: "Landed Cost",
        title: "Landed cost breakdown",
        columns: columns("Component", money("Amount", "INR"), "Status"),
        rows: components.map((component) => [component.label, component.inr, STATUS_LABEL[component.status]]),
      },
      {
        sheet: "Landed Cost",
        title: "Landed cost",
        columns: columns("Field", "Value"),
        rows: [
          ["Total purchase cost (INR)", landedCost.goodsInr],
          ["Total additional expenses (INR)", additionalInr],
          ["Total landed cost (INR)", landedCost.totalInr],
          ["Total received (stocked) quantity", landedCost.stockedPieces],
          ["Landed cost per unit (INR)", landedCost.perPieceInr],
          ["Status", costStatus(landedCost)],
        ],
      },
    );
  }
  sections.push({
    sheet: "Order Timeline",
    title: "Timeline",
    columns: columns("Event", date("Date"), "Status", "Detail", "Recorded", "By"),
    rows: timeline.map((step) => [TIMELINE_LABEL[step.step], step.on, "Done", step.detail, when(step.at), orDash(step.by)]),
  });
  return {
    title: `Order report ${order.po}`,
    filename: `order-report-${order.po.replace(/[^\w-]+/g, "-")}-${today}`,
    filters: `Supplier: ${supplier.name}${supplier.code ? ` (${supplier.code})` : ""} · Ordered ${formatDate(order.orderDate)} · ${stageLabel(order.stage)} · ${closureLabel(order)}`,
    sections,
  };
}
