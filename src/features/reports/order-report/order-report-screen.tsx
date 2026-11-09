import { PageContainer } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/cards";
import { KeyValueList } from "@/components/shared/key-value-list";
import { StatusPill } from "@/components/shared/status-pill";
import { Timeline } from "@/components/shared/timeline";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CONTAINER_STATUS } from "@/features/containers/containers-logic";
import { DepositStatusPill } from "@/features/payments/money";
import { ExportActions } from "@/features/reports/report-actions";
import type { OrderReport, OrderReportContainer } from "@/lib/api/reports-types";
import { CURRENCY_NAME, formatDate, formatINR, formatMoney, formatNumber, formatQty, formatRate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import { closureLabel, costStatus, orderReportFile, stageLabel, TIMELINE_LABEL } from "./order-report-file";

// Order detail, tab f (RPT-O1, backend docs/phase2-contracts.md 4.3). No reference screenshot: built from the order
// detail parts (cards, key-value lists, bordered tables, the shared Timeline). A section the API nulled (the user may
// not view it) is not rendered; the exports hold the same sections.

const DASH = "–";
const orDash = (value: string | null) => (value?.trim() ? value : DASH);
const day = (value: string | null) => (value ? formatDate(value) : DASH);
const inr = (value: number | null, decimals = 0) => (value === null ? DASH : formatINR(value, decimals));

type ReportColumn = { header: string; align?: "right" };

/** A bordered table of ready-made cells (the Wave 1 bordered-table look, without TanStack: nothing here is interactive). */
function ReportTable({ columns, rows, empty }: { columns: ReportColumn[]; rows: React.ReactNode[][]; empty: string }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow className="border-b bg-table-head hover:bg-transparent">
            {columns.map((column) => (
              <TableHead key={column.header} className={cn("h-[34px] px-[14.5px] text-[12.5px] font-bold text-table-head-foreground", column.align === "right" && "text-right")}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row, index) => (
              <TableRow key={index} className="h-[49px] border-b border-border-subtle hover:bg-transparent">
                {row.map((cell, column) => (
                  <TableCell key={column} className={cn("px-[14.5px] text-sm", columns[column]?.align === "right" && "text-right")}>
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="h-16 text-center text-sm text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

const right = (header: string): ReportColumn => ({ header, align: "right" });

/** One container of the Logistics card: its facts, this order's goods, and the clearing and trip when visible. */
function ContainerBlock({ container }: { container: OrderReportContainer }) {
  const status = CONTAINER_STATUS[container.status];
  const { clearing, transport } = container;
  return (
    <div className="flex flex-col gap-3 border-t border-border-subtle pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-[15px] font-bold">{container.number}</h3>
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
        <span className="text-sm text-muted-foreground">
          {container.terms} · {container.agent}
          {container.portOfLoading || container.portOfArrival ? ` · ${orDash(container.portOfLoading)} → ${orDash(container.portOfArrival)}` : null}
        </span>
      </div>
      <div className="grid gap-x-10 gap-y-3 lg:grid-cols-3">
        <KeyValueList
          size="sm"
          boldValues
          items={[
            { label: "Loaded", value: day(container.loadedOn) },
            { label: "Sailed", value: day(container.sailedOn) },
            { label: "ETA", value: formatDate(container.eta) },
            { label: "This order's goods", value: container.lines.map((line) => `${line.item}: ${formatQty(line.quantity, line.unit)}`).join(", ") || DASH },
          ]}
        />
        {clearing ? (
          <KeyValueList
            size="sm"
            items={[
              { label: `Clearing · ${clearing.agent}`, value: clearing.status === "cleared" ? <StatusPill tone="success">Cleared</StatusPill> : <StatusPill tone="info">In clearing</StatusPill> },
              { label: "Arrived · handed over", value: `${formatDate(clearing.arrivedOn)} · ${day(clearing.handedOn)}` },
              { label: "Bill of entry · duty paid", value: `${orDash(clearing.billOfEntry)} · ${day(clearing.dutyPaidOn)}` },
              { label: "Cleared", value: day(clearing.clearedOn) },
              { label: "Customs duty", value: formatINR(clearing.customsDutyInr), muted: true },
              { label: "Other duties", value: formatINR(clearing.otherDutiesInr), muted: true },
              { label: "Agent charges", value: formatINR(clearing.agentChargesInr), muted: true },
              { label: "Port charges", value: formatINR(clearing.portChargesInr), muted: true },
            ]}
            total={{ label: "Clearing (container total)", value: formatINR(clearing.totalInr) }}
          />
        ) : null}
        {transport ? (
          <KeyValueList
            size="sm"
            items={[
              { label: `Transport · ${transport.company}`, value: transport.status === "unloaded" ? <StatusPill tone="success">Unloaded</StatusPill> : <StatusPill tone="info">On the road</StatusPill> },
              { label: "LR · vehicle", value: `${transport.lrNumber} · ${transport.vehicleNumber}` },
              { label: "Driver · destination", value: `${orDash(transport.driverName)} · ${transport.destination}` },
              { label: "Loaded · unloaded", value: `${formatDate(transport.loadedOn)} · ${day(transport.unloadedOn)}` },
              { label: "Bundles loaded · received", value: `${formatNumber(transport.bundlesLoaded)} · ${transport.bundlesReceived === null ? DASH : formatNumber(transport.bundlesReceived)}` },
              { label: "Freight", value: formatINR(transport.freightInr), muted: true },
              { label: "Handling", value: formatINR(transport.handlingInr), muted: true },
            ]}
            total={{ label: "Transport (container total)", value: formatINR(transport.totalInr) }}
          />
        ) : null}
      </div>
    </div>
  );
}

export function OrderReportScreen({ report, today }: { report: OrderReport; today: string }) {
  const { order, lines, payments, logistics, warehouse, landedCost, timeline } = report;
  const cur = order.currency;
  const money = (value: number, decimals = 0) => formatMoney(value, cur, { decimals });
  const quantities = (pick: (total: OrderReport["order"]["totals"][number]) => number) => order.totals.map((total) => formatQty(pick(total), total.unit)).join(" · ") || DASH;

  return (
    <PageContainer>
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-5 py-3">
        <p className="text-[15px] text-muted-foreground">
          <span className="text-[17px] font-bold text-foreground">Order report</span> · {order.supplier.name} · Ordered {formatDate(order.orderDate)}
        </p>
        <div className="flex flex-wrap gap-2">
          <ExportActions file={orderReportFile(report, today)} formats={["xlsx", "pdf"]} size="sm" />
        </div>
      </div>

      <SectionCard title="Overview" titleGap="none">
        <div className="mt-3 grid gap-x-10 lg:grid-cols-2">
          <KeyValueList
            size="sm"
            boldValues
            items={[
              { label: "PO", value: order.po },
              { label: "Supplier", value: order.supplier.name },
              { label: "Contact", value: `${orDash(order.supplier.contactPerson)} · ${orDash(order.supplier.phone)}` },
              { label: "City", value: orDash(order.supplier.city) },
              { label: "Order date", value: formatDate(order.orderDate) },
              { label: "Delivery date", value: formatDate(order.deliveryDate) },
            ]}
          />
          <KeyValueList
            size="sm"
            boldValues
            className="border-t border-border-subtle lg:border-t-0"
            items={[
              { label: "Stage", value: stageLabel(order.stage) },
              { label: "Status", value: <StatusPill tone={order.closed ? "success" : "info"}>{closureLabel(order)}</StatusPill> },
              { label: "Currency", value: CURRENCY_NAME[cur] },
              { label: "Order value", value: money(order.orderValueCny) },
              { label: "Ordered", value: quantities((total) => total.ordered) },
              { label: "Received · stocked", value: `${quantities((total) => total.received)} · ${quantities((total) => total.stocked)}` },
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard title="Items" bottomGap="tight">
        <ReportTable
          columns={[{ header: "Item" }, right("Ordered"), right("Received"), right("Excess"), right("Short"), right("Loaded"), right("Stocked"), right("Rate"), right("Value")]}
          rows={lines.map((line) => [
            <span key="item" className="font-bold">
              {line.item}
            </span>,
            formatQty(line.ordered, line.unit),
            formatQty(line.received, line.unit),
            line.excess > 0 ? <span className="font-bold text-warning">{formatQty(line.excess, line.unit)}</span> : formatQty(0, line.unit),
            line.short > 0 ? <span className="font-bold text-danger">{formatQty(line.short, line.unit)}</span> : formatQty(0, line.unit),
            formatQty(line.loaded, line.unit),
            formatQty(line.stocked, line.unit),
            `${money(line.rateCny, 2)} / ${line.unit}`,
            money(line.valueCny),
          ])}
          empty="No items."
        />
      </SectionCard>

      {payments ? (
        <SectionCard title="Payments" titleGap="none">
          <div className="mt-3 grid gap-(--page-gap) lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <KeyValueList
              size="sm"
              items={[
                { label: "Paid to supplier", value: money(payments.paidCny) },
                { label: "Paid in INR", value: formatINR(payments.paidInr) },
                { label: "Of which deposits", value: money(payments.depositsPaidCny), muted: true },
                // The deposit the supplier asked for (0009), only when one was agreed.
                ...(payments.depositRequiredCny == null
                  ? []
                  : [
                      { label: "Deposit required", value: money(payments.depositRequiredCny), muted: true },
                      {
                        label: "Deposit pending",
                        value: (
                          <>
                            {money(payments.depositPendingCny ?? 0)} <DepositStatusPill status={payments.depositStatus} className="ml-1 align-middle" />
                          </>
                        ),
                        muted: true,
                      },
                    ]),
                { label: "Due", value: money(payments.dueCny), muted: true },
              ]}
              total={{ label: "Balance to supplier", value: money(payments.balanceCny) }}
            />
            <ReportTable
              columns={[{ header: "Date" }, { header: "Type" }, { header: "Payee" }, right("Amount"), right("Rate"), right("INR"), { header: "Mode" }, { header: "Reference" }, { header: "Status" }]}
              rows={payments.list.map((payment) => [
                payment.paidOn ? formatDate(payment.paidOn) : payment.dueDate ? `due ${formatDate(payment.dueDate)}` : DASH,
                payment.kind,
                <span key="payee" title={payment.notes || undefined}>
                  {payment.payee}
                  {payment.payeeRole === "agent" ? <span className="text-muted-foreground"> (agent)</span> : null}
                </span>,
                money(payment.amountCny),
                payment.rateInr === null ? DASH : formatRate(payment.rateInr),
                inr(payment.amountInr),
                orDash(payment.mode),
                orDash(payment.reference),
                payment.status === "paid" ? <StatusPill tone="success">Paid</StatusPill> : <StatusPill tone="warning">Due</StatusPill>,
              ])}
              empty="No payments recorded yet."
            />
          </div>
        </SectionCard>
      ) : null}

      {logistics ? (
        <SectionCard title="Logistics" titleGap="none">
          <div className="mt-3 flex flex-col gap-4">
            {logistics.length ? (
              logistics.map((container) => <ContainerBlock key={container.id} container={container} />)
            ) : (
              <p className="text-sm text-muted-foreground">Not loaded into a container yet.</p>
            )}
          </div>
        </SectionCard>
      ) : null}

      {warehouse ? (
        <SectionCard title="Warehouse" bottomGap="tight">
          <ReportTable
            columns={[{ header: "Received" }, { header: "Container" }, { header: "Warehouse" }, { header: "Received by" }, { header: "Status" }, { header: "This order's pieces per team" }]}
            rows={warehouse.map((receipt) => [
              formatDate(receipt.receivedOn),
              receipt.container,
              receipt.warehouse,
              receipt.receivedBy,
              receipt.status === "stocked" ? <StatusPill tone="success">Stocked</StatusPill> : <StatusPill tone="warning">Draft</StatusPill>,
              receipt.lines.map((line) => `${line.team}: ${formatQty(line.quantity, line.unit)} ${line.item}`).join(" · ") || DASH,
            ])}
            empty="Not received in the warehouse yet."
          />
        </SectionCard>
      ) : null}

      <div className="grid gap-(--page-gap) lg:grid-cols-2">
        {landedCost ? (
          <SectionCard title="Landed cost" titleGap="none" aside={<StatusPill tone={landedCost.final ? "success" : "warning"}>{landedCost.final ? "Final" : "Estimate"}</StatusPill>}>
            <KeyValueList
              size="sm"
              className="mt-3"
              items={[
                { label: "Goods (supplier payments)", value: formatINR(landedCost.goodsInr) },
                { label: "Sea freight", value: formatINR(landedCost.seaFreightInr) },
                { label: "Clearing (allocated share)", value: inr(landedCost.clearingInr) },
                { label: "Transport (allocated share)", value: inr(landedCost.transportInr) },
                { label: "Stocked pieces", value: formatNumber(landedCost.stockedPieces), muted: true },
                { label: "Per piece", value: inr(landedCost.perPieceInr, 2), muted: true },
                { label: "Status", value: costStatus(landedCost), muted: true },
              ]}
              total={{ label: "Landed cost", value: formatINR(landedCost.totalInr) }}
            />
          </SectionCard>
        ) : null}
        <SectionCard title="Timeline" titleGap="none">
          <Timeline
            size="sm"
            className="mt-3"
            items={timeline.map((step) => ({ title: `${TIMELINE_LABEL[step.step]} · ${formatDate(step.on)}`, detail: step.detail, marker: "check" }))}
          />
        </SectionCard>
      </div>
    </PageContainer>
  );
}
