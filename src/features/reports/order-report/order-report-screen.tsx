import Link from "next/link";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import { KeyValueList } from "@/components/shared/key-value-list";
import { StatusPill } from "@/components/shared/status-pill";
import { Timeline } from "@/components/shared/timeline";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CONTAINER_STATUS } from "@/features/containers/containers-logic";
import { DepositStatusPill } from "@/features/payments/money";
import { ExportActions } from "@/features/reports/report-actions";
import type { OrderReport, OrderReportContainer, OrderReportDeposit } from "@/lib/api/reports-types";
import { CURRENCY_NAME, formatDate, formatDateTime, formatINR, formatMoney, formatMoneyList, formatNumber, formatQty, rateText, formatRate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { type MoneyTotal, STAGES } from "@/types/domain";

import { closureLabel, costStatus, landedCostBreakdown, orderReportFile, REPORT_SECTIONS, stageLabel, TIMELINE_LABEL } from "./order-report-file";

// The comprehensive order report (RPT-O1, backend docs/order-report.md): every section the API gave, in the order of
// the section navigation, from the order detail parts (cards, key-value lists, bordered tables, the shared Timeline).
// A section the API nulled (the user may not view it) says so instead of showing figures; the exports hold the same
// sections. Money: amounts in the order's currency, INR at each payment's own rate, never added across currencies.
// `frame`: "reports" draws the Reports breadcrumb header with Back and the exports; "order" sits inside the order's
// frame (tab f) and keeps its strip.

const DASH = "–";
const orDash = (value: string | null | undefined) => (value?.trim() ? value : DASH);
const day = (value: string | null) => (value ? formatDate(value) : DASH);
const when = (value: string | null) => (value ? formatDateTime(value) : DASH);
const inr = (value: number | null, decimals = 0) => (value === null ? DASH : formatINR(value, decimals));
/** Ledger-style figures keep their paise: "¥1,000.50 · $200.00", or a dash when there is nothing. */
const moneyList = (totals: MoneyTotal[]) => (totals.length ? formatMoneyList(totals, { decimals: 2 }) : DASH);
const plural = (count: number, noun: string) => `${formatNumber(count)} ${noun}${count === 1 ? "" : "s"}`;

type ReportColumn = { header: string; align?: "right" };
const right = (header: string): ReportColumn => ({ header, align: "right" });

/** A bordered table of ready-made cells (the Wave 1 bordered-table look, without TanStack: nothing here is interactive); scrolls inside on a phone. */
function ReportTable({ columns, rows, total, empty }: { columns: ReportColumn[]; rows: React.ReactNode[][]; total?: React.ReactNode[]; empty: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow className="border-b bg-table-head hover:bg-transparent">
            {columns.map((column) => (
              <TableHead key={column.header} className={cn("h-[34px] px-[14.5px] text-[12.5px] font-bold whitespace-nowrap text-table-head-foreground", column.align === "right" && "text-right")}>
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
          {total && rows.length ? (
            <TableRow className="h-[49px] border-t-2 border-navy bg-table-head font-bold hover:bg-transparent">
              {total.map((cell, column) => (
                <TableCell key={column} className={cn("px-[14.5px] text-sm", columns[column]?.align === "right" && "text-right")}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

/** Muted note under a table or card. */
function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] leading-4 text-muted-foreground">{children}</p>;
}

/** A section the API nulled: the user's access to its capability is below View. */
function NotVisible({ what }: { what: string }) {
  return <p className="text-sm text-muted-foreground">{what} are outside your access.</p>;
}

/** The section navigation: anchor links to the twelve sections, sticky under the page header. */
function SectionNav() {
  return (
    <nav
      aria-label="Report sections"
      className="sticky top-[calc(3.5rem+var(--header-height))] z-10 -mx-4 flex gap-1 overflow-x-auto border-b bg-card px-4 py-2 md:top-(--header-height) md:-mx-(--page-padding) md:px-(--page-padding)"
    >
      {REPORT_SECTIONS.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="shrink-0 rounded-full border px-3 py-1 text-[13px] font-bold whitespace-nowrap text-label outline-none hover:bg-neutral-soft focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}

/** The six stages as a horizontal lifecycle: passed stages ticked, the current one ringed, the rest pending; a closed order ticks all six. */
function Lifecycle({ stage, closed }: { stage: number; closed: boolean }) {
  return (
    <ol className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Order lifecycle">
      {STAGES.map((name, index) => {
        const number = index + 1;
        const state = closed || number < stage ? "done" : number === stage ? "current" : "pending";
        return (
          <li key={name} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                state === "done" ? "bg-success-strong text-white" : state === "current" ? "border-2 border-primary bg-card text-primary" : "border-2 border-chip-muted bg-card text-muted-foreground",
              )}
            >
              {state === "done" ? "✓" : number}
            </span>
            <span className={cn(state === "current" && "font-bold", state === "pending" && "text-muted-foreground")}>
              <span className="sr-only">{state === "done" ? "Done: " : state === "current" ? "Current: " : "Pending: "}</span>
              {number}. {name}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** The recorded author and moment of a stage record. */
const recorded = (by: string | null, at: string | null) => (by || at ? `${orDash(by)} · ${when(at)}` : DASH);

/** One container's shipping facts (Section E). */
function ShippingBlock({ container }: { container: OrderReportContainer }) {
  const status = CONTAINER_STATUS[container.status];
  return (
    <div className="flex flex-col gap-3 border-t border-border-subtle pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-[15px] font-bold">{container.number}</h3>
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
        <span className="text-sm text-muted-foreground">
          {container.terms} · {container.agent}
        </span>
      </div>
      <div className="grid gap-x-10 gap-y-3 lg:grid-cols-2">
        <KeyValueList
          size="sm"
          boldValues
          items={[
            { label: "Shipping agent", value: container.agent },
            { label: "Terms", value: container.terms },
            { label: "Port of loading", value: orDash(container.portOfLoading) },
            { label: "Destination port", value: orDash(container.portOfArrival) },
            { label: "Recorded", value: recorded(container.recordedBy, container.recordedAt) },
          ]}
        />
        <KeyValueList
          size="sm"
          boldValues
          className="border-t border-border-subtle lg:border-t-0"
          items={[
            { label: "Loaded", value: day(container.loadedOn) },
            { label: "Departed (sailed)", value: day(container.sailedOn) },
            { label: container.etaEstimated ? "Estimated arrival (estimate)" : "Estimated arrival", value: formatDate(container.eta) },
            { label: "Actual arrival", value: container.clearing ? formatDate(container.clearing.arrivedOn) : DASH },
            { label: "This order's goods", value: container.lines.map((line) => `${line.item}: ${formatQty(line.quantity, line.unit)} (${plural(line.bundles, "bundle")})`).join(", ") || DASH },
          ]}
        />
      </div>
    </div>
  );
}

/** One container's clearing (Section F). */
function CustomsBlock({ container }: { container: OrderReportContainer }) {
  const { clearing } = container;
  return (
    <div className="flex flex-col gap-3 border-t border-border-subtle pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-[15px] font-bold">{container.number}</h3>
        {clearing ? (
          clearing.status === "cleared" ? (
            <StatusPill tone="success">Cleared</StatusPill>
          ) : (
            <StatusPill tone="info">In clearing</StatusPill>
          )
        ) : (
          <StatusPill tone="neutral">No clearing recorded</StatusPill>
        )}
      </div>
      {clearing ? (
        <div className="grid gap-x-10 gap-y-3 lg:grid-cols-2">
          <KeyValueList
            size="sm"
            boldValues
            items={[
              { label: "Clearing agent", value: clearing.agent },
              { label: "Arrived at port", value: formatDate(clearing.arrivedOn) },
              { label: "Handed over", value: day(clearing.handedOn) },
              { label: "Bill of entry", value: orDash(clearing.billOfEntry) },
              { label: "Duty paid", value: day(clearing.dutyPaidOn) },
              { label: "Cleared", value: day(clearing.clearedOn) },
              { label: "Goods value (information only)", value: inr(clearing.goodsValueInr) },
              { label: "Recorded", value: recorded(clearing.recordedBy, clearing.recordedAt) },
            ]}
          />
          <KeyValueList
            size="sm"
            className="border-t border-border-subtle lg:border-t-0"
            items={[
              { label: "Customs duty", value: formatINR(clearing.customsDutyInr) },
              { label: "Other duties and taxes", value: formatINR(clearing.otherDutiesInr) },
              { label: "Clearing agent charges", value: formatINR(clearing.agentChargesInr) },
              { label: "Port charges", value: formatINR(clearing.portChargesInr) },
            ]}
            total={{ label: "Clearing (container total)", value: formatINR(clearing.totalInr) }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** One container's road trip (Section G). */
function TransportBlock({ container }: { container: OrderReportContainer }) {
  const trip = container.transport;
  return (
    <div className="flex flex-col gap-3 border-t border-border-subtle pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-[15px] font-bold">{container.number}</h3>
        {trip ? trip.status === "unloaded" ? <StatusPill tone="success">Unloaded</StatusPill> : <StatusPill tone="info">On the road</StatusPill> : <StatusPill tone="neutral">No trip recorded</StatusPill>}
      </div>
      {trip ? (
        <div className="grid gap-x-10 gap-y-3 lg:grid-cols-2">
          <KeyValueList
            size="sm"
            boldValues
            items={[
              { label: "Transport company", value: trip.company },
              { label: "LR number", value: trip.lrNumber },
              { label: "Vehicle", value: trip.vehicleNumber },
              { label: "Driver", value: `${orDash(trip.driverName)} · ${orDash(trip.driverPhone)}` },
              { label: "Loaded from · by", value: `${orDash(trip.loadedFrom)} · ${orDash(trip.loadedBy)}` },
              { label: "Dispatched", value: formatDate(trip.loadedOn) },
              { label: "Arrived at warehouse", value: `${day(trip.unloadedOn)} · ${trip.destination}` },
              { label: "Bundles loaded · received", value: `${formatNumber(trip.bundlesLoaded)} · ${trip.bundlesReceived === null ? DASH : formatNumber(trip.bundlesReceived)}` },
              { label: "Received by", value: orDash(trip.receivedBy) },
              { label: "Shortage remark", value: orDash(trip.shortRemark) },
              { label: "Recorded", value: recorded(trip.recordedBy, trip.recordedAt) },
            ]}
          />
          <KeyValueList
            size="sm"
            className="border-t border-border-subtle lg:border-t-0"
            items={[
              { label: "Freight", value: formatINR(trip.freightInr) },
              { label: "Loading and unloading", value: formatINR(trip.handlingInr) },
            ]}
            total={{ label: "Transport (container total)", value: formatINR(trip.totalInr) }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** A supplier-level deposit with its transactions (Section I). */
function DepositBlock({ deposit }: { deposit: OrderReportDeposit }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border-subtle pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-[15px] font-bold">{deposit.reference || "Deposit"}</h3>
        <StatusPill tone={deposit.status === "settled" ? "success" : deposit.status === "partly settled" ? "warning" : "info"}>{deposit.status}</StatusPill>
        <span className="text-sm text-muted-foreground">
          {deposit.direction === "give" ? "To give to the supplier" : "To receive from the supplier"} · agreed {formatDate(deposit.openedOn)}
        </span>
      </div>
      <KeyValueList
        size="sm"
        boldValues
        items={[
          { label: "Deposit amount", value: formatMoney(deposit.amount, deposit.currency) },
          { label: "Rate when opened", value: deposit.exchangeRate === null ? "Not saved" : rateText(deposit.currency, deposit.exchangeRate) },
          { label: "Settled so far", value: formatMoney(deposit.settled, deposit.currency) },
          { label: "Remaining", value: formatMoney(deposit.pending, deposit.currency) },
          { label: "Applied to this PO", value: "Not tracked (account-level deposit)" },
          { label: "Notes", value: orDash(deposit.notes) },
        ]}
      />
      <ReportTable
        columns={[{ header: "Date" }, { header: "Reference" }, { header: "Mode" }, right("Amount"), { header: "Notes" }]}
        rows={deposit.transactions.map((transaction) => [formatDate(transaction.paidOn), orDash(transaction.reference), transaction.mode, formatMoney(transaction.amount, deposit.currency), orDash(transaction.notes)])}
        empty="No transactions against this deposit yet."
      />
    </div>
  );
}

export function OrderReportScreen({ report, today, frame = "order" }: { report: OrderReport; today: string; frame?: "order" | "reports" }) {
  const { order, lines, payments, supplierAccount, receipts, logistics, warehouse, landedCost, timeline } = report;
  const cur = order.currency;
  const money = (value: number, decimals = 0) => formatMoney(value, cur, { decimals });
  const quantities = (pick: (total: OrderReport["order"]["totals"][number]) => number) => order.totals.map((total) => formatQty(pick(total), total.unit)).join(" · ") || DASH;
  const completion = order.totals.map((total) => `${total.unit}: ${total.ordered ? Math.min(100, Math.round((total.received / total.ordered) * 100)) : 0}% received`).join(" · ") || DASH;
  const supplier = order.supplier;
  // Paid rows only in the sea freight and PO deposit tables (their totals are paid money); due rows stay in the ledger.
  const agentPayments = payments?.list.filter((payment) => payment.payeeRole === "agent" && payment.status === "paid") ?? [];
  const poDeposits = payments?.list.filter((payment) => payment.payeeRole === "supplier" && payment.kind === "Deposit" && payment.status === "paid") ?? [];
  const breakdown = landedCost ? landedCostBreakdown(landedCost, logistics) : null;
  const exports = <ExportActions file={orderReportFile(report, today)} formats={["xlsx", "pdf", "csv"]} size="sm" />;
  const section = (id: string) => ({ id, className: "scroll-mt-[calc(3.5rem+var(--header-height)+52px)] md:scroll-mt-[calc(var(--header-height)+52px)]" });

  return (
    <>
      {frame === "reports" ? (
        <PageHeader
          title={order.po}
          parent={{ label: "Reports › Order Report", href: "/reports/orders" }}
          titleAddon={<StatusPill tone={order.closed ? "success" : "info"}>{closureLabel(order)}</StatusPill>}
          actions={
            // Hidden on phones (an undesigned width), where four buttons would squeeze the PO out of the header; the strip below carries them.
            <div className="hidden items-center gap-3.5 sm:flex">
              <Button asChild variant="outline" size="header">
                <Link href="/reports/orders">Back to Order Reports</Link>
              </Button>
              {exports}
            </div>
          }
        />
      ) : null}
      <PageContainer>
        <div className={cn("flex min-h-12 flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-5 py-3", frame === "reports" && "sm:hidden")}>
          <p className="text-[15px] text-muted-foreground">
            <span className="text-[17px] font-bold text-foreground">Order report</span> · {supplier.name} · Ordered {formatDate(order.orderDate)}
          </p>
          <div className="flex flex-wrap gap-2">
            {frame === "reports" ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/reports/orders">Back</Link>
              </Button>
            ) : null}
            {exports}
          </div>
        </div>
        <SectionNav />

        {/* A. Overview */}
        <SectionCard title="Overview" titleGap="none" {...section("overview")}>
          <div className="mt-3 flex flex-col gap-4">
            <KpiRow gap="sm" className="grid-cols-2 md:grid-flow-row md:grid-cols-4">
              <KpiCard size="xs" label="Original PO value" value={money(order.orderValueCny)} sub={`${plural(order.products, "product")} · ${quantities((t) => t.ordered)}`} />
              <KpiCard size="xs" label="Paid to supplier" value={payments ? money(payments.paidCny) : DASH} sub={payments ? `${formatINR(payments.paidInr)} at payment-day rates` : "outside your access"} />
              <KpiCard size="xs" label="Outstanding balance" value={payments ? money(payments.balanceCny) : DASH} sub={payments ? `${money(payments.dueCny)} due` : "outside your access"} tone={payments && payments.balanceCny > 0 ? "danger" : "default"} />
              <KpiCard size="xs" label="Received · pending" value={quantities((t) => t.received)} sub={`pending ${quantities((t) => t.pending)}`} />
            </KpiRow>
            <Lifecycle stage={order.stage} closed={order.closed} />
            <div className="grid gap-x-10 lg:grid-cols-2">
              <KeyValueList
                size="sm"
                boldValues
                items={[
                  { label: "PO number", value: order.po },
                  { label: "Order ID", value: <span className="break-all">{order.id}</span> },
                  { label: "Created", value: `${when(order.createdAt)}${order.createdBy ? ` · ${order.createdBy}` : ""}` },
                  { label: "Last updated", value: when(order.updatedAt) },
                  { label: "Order date", value: formatDate(order.orderDate) },
                  { label: "Delivery date", value: formatDate(order.deliveryDate) },
                  { label: "Supplier", value: `${supplier.name}${supplier.code ? ` (${supplier.code})` : ""}` },
                ]}
              />
              <KeyValueList
                size="sm"
                boldValues
                className="border-t border-border-subtle lg:border-t-0"
                items={[
                  { label: "Status", value: <StatusPill tone={order.closed ? "success" : "info"}>{closureLabel(order)}</StatusPill> },
                  { label: "Stage", value: stageLabel(order.stage) },
                  { label: "Currency", value: CURRENCY_NAME[cur] },
                  // The rate saved when the PO was placed, never the supplier's current one (docs/supplier-currency.md).
                  { label: "Exchange rate on this PO", value: order.exchangeRate === null ? "Not saved (placed before rates were kept)" : rateText(cur, order.exchangeRate) },
                  { label: "PO value in INR", value: order.orderValueInr === null ? DASH : `${formatINR(order.orderValueInr, 2)} at the PO rate` },
                  { label: "Products", value: formatNumber(order.products) },
                  { label: "Ordered", value: quantities((t) => t.ordered) },
                  { label: "Received in China · pending", value: `${quantities((t) => t.received)} · ${quantities((t) => t.pending)}` },
                  { label: "Stocked in warehouse", value: quantities((t) => t.stocked) },
                  { label: "Completion (received of ordered)", value: completion },
                ]}
              />
            </div>
          </div>
        </SectionCard>

        {/* B. Supplier */}
        <SectionCard title="Supplier" titleGap="none" {...section("supplier")}>
          <div className="mt-3 grid gap-x-10 gap-y-4 lg:grid-cols-3">
            <div>
              <h3 className="mb-1 text-[12.5px] font-bold tracking-[0.04em] text-muted-foreground uppercase">Basic information</h3>
              <KeyValueList
                size="sm"
                boldValues
                items={[
                  { label: "Supplier code", value: orDash(supplier.code) },
                  { label: "Supplier name", value: supplier.name },
                  { label: "Country", value: orDash(supplier.country) },
                  { label: "Status", value: <StatusPill tone={supplier.status === "Active" ? "success" : "neutral"}>{supplier.status}</StatusPill> },
                ]}
              />
            </div>
            <div>
              <h3 className="mb-1 text-[12.5px] font-bold tracking-[0.04em] text-muted-foreground uppercase">Contact information</h3>
              <KeyValueList
                size="sm"
                boldValues
                items={[
                  { label: "Contact person", value: orDash(supplier.contactPerson) },
                  { label: "Email", value: orDash(supplier.email) },
                  { label: "Phone", value: orDash(supplier.phone) },
                  { label: "Address", value: orDash(supplier.address) },
                  { label: "City · State", value: `${orDash(supplier.city)} · ${orDash(supplier.state)}` },
                  { label: "Postal code", value: orDash(supplier.postalCode) },
                ]}
              />
            </div>
            <div>
              <h3 className="mb-1 text-[12.5px] font-bold tracking-[0.04em] text-muted-foreground uppercase">Business information</h3>
              <KeyValueList
                size="sm"
                boldValues
                items={[
                  { label: "Payment terms", value: orDash(supplier.paymentTerms) },
                  { label: "Supplier currency", value: CURRENCY_NAME[supplier.currency] },
                  { label: "Exchange rate now", value: supplier.exchangeRate === null ? "Not set" : rateText(supplier.currency, supplier.exchangeRate) },
                  { label: "Rate last updated", value: when(supplier.rateUpdatedAt) },
                  { label: "Tax / registration number", value: orDash(supplier.taxNumber) },
                  { label: "Notes", value: orDash(supplier.notes) },
                ]}
              />
            </div>
          </div>
          <div className="mt-4 border-t border-border-subtle pt-4">
            <h3 className="mb-1 text-[12.5px] font-bold tracking-[0.04em] text-muted-foreground uppercase">Supplier financial summary</h3>
            {payments && supplierAccount ? (
              <div className="grid gap-x-10 lg:grid-cols-2">
                <KeyValueList
                  size="sm"
                  boldValues
                  items={[
                    { label: "Total purchase value with this supplier", value: `${moneyList(supplierAccount.purchaseValue)} · ${plural(supplierAccount.orders, "order")}` },
                    { label: "Supplier's overall balance (every order)", value: moneyList(supplierAccount.balance) },
                    { label: "Amount paid for this PO", value: money(payments.paidCny, 2) },
                    { label: "Outstanding balance for this PO", value: money(payments.balanceCny, 2) },
                  ]}
                />
                <KeyValueList
                  size="sm"
                  boldValues
                  className="border-t border-border-subtle lg:border-t-0"
                  items={[
                    { label: "Deposits paid on this PO", value: money(payments.depositsPaidCny, 2) },
                    ...supplierAccount.deposits.summary.map((line) => ({
                      label: `Supplier deposit ${line.direction === "give" ? "to give" : "to receive"} (${line.currency})`,
                      value: `${formatMoney(line.amount, line.currency, { decimals: 2 })} agreed · ${formatMoney(line.settled, line.currency, { decimals: 2 })} settled · ${formatMoney(line.pending, line.currency, { decimals: 2 })} remaining`,
                    })),
                    ...(supplierAccount.deposits.summary.length ? [] : [{ label: "Supplier deposits (account level)", value: "None" }]),
                    { label: "Deposit utilised for this PO", value: "Not tracked: account deposits are not linked to orders" },
                  ]}
                />
              </div>
            ) : (
              <NotVisible what="Payments and the supplier's account" />
            )}
            <Note>
              This PO&apos;s paid and balance count payments on this order only. The supplier&apos;s overall figures add every order of the supplier, one total
              per currency. Account-level deposits are never counted as payments on this PO.
            </Note>
          </div>
        </SectionCard>

        {/* C. Items */}
        <SectionCard title="Items" bottomGap="tight" {...section("items")}>
          <ReportTable
            columns={[{ header: "Sl. No." }, { header: "Item code" }, { header: "Item" }, { header: "Unit" }, right("Quantity"), right("Received"), right("Pending"), right("Excess"), right("Loaded"), right("Stocked"), right(`Rate (${cur})`), right(`Amount (${cur})`)]}
            rows={lines.map((line) => [
              formatNumber(line.position + 1),
              DASH,
              <span key="item" className="font-bold">
                {line.item}
              </span>,
              line.unit,
              formatNumber(line.ordered),
              formatNumber(line.received),
              line.pending > 0 ? <span className="font-bold text-danger">{formatNumber(line.pending)}</span> : "0",
              line.excess > 0 ? <span className="font-bold text-warning">{formatNumber(line.excess)}</span> : "0",
              formatNumber(line.loaded),
              formatNumber(line.stocked),
              formatNumber(line.rateCny, 2),
              money(line.valueCny, 2),
            ])}
            total={["", "", `${plural(order.products, "item")}`, "", quantities((t) => t.ordered), quantities((t) => t.received), quantities((t) => t.pending), "", "", quantities((t) => t.stocked), "", money(order.orderValueCny, 2)]}
            empty="No items."
          />
          <Note>
            Rate and amount are the values saved on the PO line when the order was placed; editing the master item price never changes them. Items
            have no code, description or line notes in this system, and no quantity adjustments are recorded apart from receipts.
          </Note>
        </SectionCard>

        {/* D. China processing */}
        <SectionCard title="China processing" titleGap="none" {...section("china")}>
          <div className="mt-3 flex flex-col gap-4">
            {receipts === null ? (
              <NotVisible what="China receipts" />
            ) : receipts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing received in China yet.</p>
            ) : (
              receipts.map((receipt, index) => (
                <div key={receipt.id} className="flex flex-col gap-3 border-t border-border-subtle pt-4 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-[15px] font-bold">Receipt {index + 1}</h3>
                    <StatusPill tone="success">Received {formatDate(receipt.receivedOn)}</StatusPill>
                    <span className="text-sm text-muted-foreground">
                      {receipt.office} · received by {orDash(receipt.receivedBy)} · recorded {when(receipt.recordedAt)}
                    </span>
                  </div>
                  <div className="grid gap-x-10 gap-y-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    <KeyValueList
                      size="sm"
                      boldValues
                      items={[
                        { label: "Bundles", value: formatNumber(receipt.bundles) },
                        { label: "Delivery note", value: orDash(receipt.deliveryNote) },
                        { label: "Shortage remark", value: orDash(receipt.shortRemark) },
                      ]}
                    />
                    <ReportTable
                      columns={[{ header: "Item" }, right("Received")]}
                      rows={receipt.lines.map((line) => [line.item, formatQty(line.quantity, line.unit)])}
                      empty="No lines on this receipt."
                    />
                  </div>
                </div>
              ))
            )}
            <Note>
              Received, pending and excess per item are in the Items section. Supplier confirmation, production status and attachments are not recorded
              in this system; the first receipt is the order&apos;s delivery in China.
            </Note>
          </div>
        </SectionCard>

        {/* E. Shipping */}
        <SectionCard title="Shipping" titleGap="none" {...section("shipping")}>
          <div className="mt-3 flex flex-col gap-4">
            {logistics === null ? (
              <NotVisible what="Containers" />
            ) : logistics.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not loaded into a container yet.</p>
            ) : (
              logistics.map((container) => <ShippingBlock key={container.id} container={container} />)
            )}
            {payments ? (
              <div className="border-t border-border-subtle pt-4">
                <h3 className="mb-2 text-[12.5px] font-bold tracking-[0.04em] text-muted-foreground uppercase">Sea freight paid to shipping agents</h3>
                <ReportTable
                  columns={[{ header: "Date" }, { header: "Agent" }, { header: "Reference" }, right(`Amount (${cur})`), right("Rate"), right("INR"), { header: "Status" }]}
                  rows={agentPayments.map((payment) => [
                    payment.paidOn ? formatDate(payment.paidOn) : payment.dueDate ? `due ${formatDate(payment.dueDate)}` : DASH,
                    payment.payee,
                    orDash(payment.reference),
                    money(payment.amountCny, 2),
                    payment.rateInr === null ? DASH : formatRate(payment.rateInr),
                    inr(payment.amountInr),
                    payment.status === "paid" ? <StatusPill tone="success">Paid</StatusPill> : <StatusPill tone="warning">Due</StatusPill>,
                  ])}
                  total={["", "Sea freight paid", "", money(payments.agentPaidCny, 2), "", formatINR(payments.agentPaidInr), ""]}
                  empty="No payments to shipping agents (CNF terms, or none recorded yet)."
                />
              </div>
            ) : null}
            <Note>
              Container type, booking date, insurance and shipping charges other than the agent payments above are not recorded in this system. Sea
              freight counts in the landed cost, never in the supplier&apos;s paid or balance.
            </Note>
          </div>
        </SectionCard>

        {/* F. Customs */}
        <SectionCard title="Customs" titleGap="none" {...section("customs")}>
          <div className="mt-3 flex flex-col gap-4">
            {logistics === null ? (
              <NotVisible what="Clearing records" />
            ) : logistics.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing has reached India yet.</p>
            ) : (
              logistics.map((container) => <CustomsBlock key={container.id} container={container} />)
            )}
            <Note>
              Charges are each container&apos;s recorded totals; the order&apos;s allocated share is in the Landed cost section. GST is not recorded apart from
              &quot;other duties and taxes&quot;; customs documents are not stored.
            </Note>
          </div>
        </SectionCard>

        {/* G. Warehouse */}
        <SectionCard title="Transport and warehouse" titleGap="none" {...section("warehouse")}>
          <div className="mt-3 flex flex-col gap-4">
            {logistics === null ? (
              <NotVisible what="Transport records" />
            ) : logistics.length === 0 ? (
              <p className="text-sm text-muted-foreground">No road transport yet.</p>
            ) : (
              logistics.map((container) => <TransportBlock key={container.id} container={container} />)
            )}
            {warehouse === null ? (
              <NotVisible what="Warehouse receipts" />
            ) : (
              <div className="border-t border-border-subtle pt-4">
                <h3 className="mb-2 text-[12.5px] font-bold tracking-[0.04em] text-muted-foreground uppercase">Warehouse receiving</h3>
                <ReportTable
                  columns={[{ header: "Received" }, { header: "Container" }, { header: "Warehouse" }, { header: "Received by" }, { header: "Status" }, right("Bundles"), { header: "This order's pieces per team" }, { header: "Recorded" }]}
                  rows={warehouse.map((receipt) => [
                    formatDate(receipt.receivedOn),
                    receipt.container,
                    receipt.warehouse,
                    receipt.receivedBy,
                    receipt.status === "stocked" ? <StatusPill tone="success">Stocked</StatusPill> : <StatusPill tone="warning">Draft</StatusPill>,
                    formatNumber(receipt.bundlesReceived),
                    receipt.lines.map((line) => `${line.team}: ${formatQty(line.quantity, line.unit)} ${line.item}`).join(" · ") || DASH,
                    recorded(receipt.recordedBy, receipt.recordedAt),
                  ])}
                  empty="Not received in the warehouse yet."
                />
              </div>
            )}
            <Note>Dispatched and received quantities are per container trip (bundles) and per stocked receipt (pieces per team); damage is recorded as the shortage remark.</Note>
          </div>
        </SectionCard>

        {/* H. Payments */}
        <SectionCard title="Payments" titleGap="none" {...section("payments")}>
          <div className="mt-3 flex flex-col gap-4">
            {payments ? (
              <>
                <KpiRow gap="sm" className="grid-cols-2 md:grid-flow-row md:grid-cols-5">
                  <KpiCard size="xs" label="Original PO amount" value={money(order.orderValueCny)} />
                  <KpiCard size="xs" label="Total paid to supplier" value={money(payments.paidCny)} sub={`${formatINR(payments.paidInr)} in INR`} />
                  <KpiCard size="xs" label="Of which deposits" value={money(payments.depositsPaidCny)} sub="kind Deposit on this PO" />
                  <KpiCard size="xs" label="Due (recorded)" value={money(payments.dueCny)} sub="payments marked due" />
                  <KpiCard size="xs" label="Outstanding balance" value={money(payments.balanceCny)} sub="PO amount less paid" tone={payments.balanceCny > 0 ? "danger" : "default"} />
                </KpiRow>
                {payments.depositRequiredCny != null ? (
                  <KeyValueList
                    size="sm"
                    items={[
                      { label: "Deposit the supplier asked for", value: money(payments.depositRequiredCny) },
                      {
                        label: "Deposit still pending",
                        value: (
                          <>
                            {money(payments.depositPendingCny ?? 0)} <DepositStatusPill status={payments.depositStatus} className="ml-1 align-middle" />
                          </>
                        ),
                      },
                    ]}
                  />
                ) : null}
                <ReportTable
                  columns={[{ header: "Payment date" }, { header: "Reference" }, { header: "Type" }, { header: "Method" }, right("Amount"), { header: "Currency" }, right("Rate"), right("INR"), { header: "Payee" }, { header: "Deposit ref." }, { header: "Notes" }, { header: "Status" }, { header: "Recorded by" }]}
                  rows={payments.list.map((payment) => [
                    payment.paidOn ? formatDate(payment.paidOn) : payment.dueDate ? `due ${formatDate(payment.dueDate)}` : DASH,
                    orDash(payment.reference),
                    payment.kind === "Deposit" ? "Advance / deposit" : "Balance",
                    orDash(payment.mode),
                    formatNumber(payment.amountCny, 2),
                    cur,
                    payment.rateInr === null ? DASH : formatRate(payment.rateInr),
                    inr(payment.amountInr),
                    <span key="payee">
                      {payment.payee}
                      {payment.payeeRole === "agent" ? <span className="text-muted-foreground"> (shipping agent)</span> : null}
                    </span>,
                    DASH,
                    orDash(payment.notes),
                    payment.status === "paid" ? <StatusPill tone="success">Paid</StatusPill> : <StatusPill tone="warning">Due</StatusPill>,
                    orDash(payment.recordedBy),
                  ])}
                  empty="No payments recorded yet."
                />
                <Note>
                  Paid, deposits and balance count payments to the supplier only; a shipping agent&apos;s row is sea freight. Payments are recorded as paid or
                  due; refunds, reversals and credits are not recorded in this system, and no deposit reference links a payment to an account deposit.
                </Note>
              </>
            ) : (
              <NotVisible what="Payments" />
            )}
          </div>
        </SectionCard>

        {/* I. Deposits */}
        <SectionCard title="Deposits" titleGap="none" {...section("deposits")}>
          <div className="mt-3 flex flex-col gap-4">
            {payments && supplierAccount ? (
              <>
                <div>
                  <h3 className="mb-2 text-[12.5px] font-bold tracking-[0.04em] text-muted-foreground uppercase">Deposits paid on this PO</h3>
                  <ReportTable
                    columns={[{ header: "Date" }, { header: "Reference" }, right(`Amount (${cur})`), right("Rate"), right("INR"), { header: "Mode" }, { header: "Status" }, { header: "Notes" }]}
                    rows={poDeposits.map((payment) => [
                      payment.paidOn ? formatDate(payment.paidOn) : payment.dueDate ? `due ${formatDate(payment.dueDate)}` : DASH,
                      orDash(payment.reference),
                      money(payment.amountCny, 2),
                      payment.rateInr === null ? DASH : formatRate(payment.rateInr),
                      inr(payment.amountInr),
                      orDash(payment.mode),
                      payment.status === "paid" ? <StatusPill tone="success">Paid</StatusPill> : <StatusPill tone="warning">Due</StatusPill>,
                      orDash(payment.notes),
                    ])}
                    total={["", "Deposits paid", money(payments.depositsPaidCny, 2), "", "", "", "", ""]}
                    empty="No deposit paid on this PO."
                  />
                </div>
                <div className="border-t border-border-subtle pt-4">
                  <h3 className="mb-2 text-[12.5px] font-bold tracking-[0.04em] text-muted-foreground uppercase">Supplier account deposits (not linked to this PO)</h3>
                  {supplierAccount.deposits.list.length ? (
                    <div className="flex flex-col gap-4">
                      {supplierAccount.deposits.list.map((deposit) => (
                        <DepositBlock key={deposit.id} deposit={deposit} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">This supplier holds no account-level deposit.</p>
                  )}
                </div>
                <Note>
                  Account-level deposits are agreed with the supplier outside any order and settled by their own transactions. They are shown for context
                  and never counted as payments on this PO.
                </Note>
              </>
            ) : (
              <NotVisible what="Deposits" />
            )}
          </div>
        </SectionCard>

        {/* J. Landed cost */}
        <SectionCard
          title="Landed cost"
          titleGap="none"
          aside={landedCost ? <StatusPill tone={landedCost.final ? "success" : "warning"}>{landedCost.final ? "Final" : "Estimate"}</StatusPill> : undefined}
          {...section("landed-cost")}
        >
          <div className="mt-3 flex flex-col gap-4">
            {landedCost && breakdown ? (
              <>
                <ReportTable
                  columns={[{ header: "Component" }, right("Amount (INR)"), { header: "Status" }]}
                  rows={breakdown.components.map((component) => [
                    component.label,
                    component.inr === null ? DASH : formatINR(component.inr),
                    component.status === "recorded" ? (
                      <StatusPill tone="success">Recorded</StatusPill>
                    ) : component.status === "partial" ? (
                      <StatusPill tone="warning">Partly paid</StatusPill>
                    ) : component.status === "missing" ? (
                      <StatusPill tone="warning">Missing</StatusPill>
                    ) : component.status === "not applicable" ? (
                      <StatusPill tone="neutral">Not applicable</StatusPill>
                    ) : (
                      <StatusPill tone="neutral">Not recorded here</StatusPill>
                    ),
                  ])}
                  empty="No cost yet."
                />
                <div className="grid gap-x-10 lg:grid-cols-2">
                  <KeyValueList
                    size="sm"
                    items={[
                      { label: "Total purchase cost (supplier payments, INR)", value: formatINR(landedCost.goodsInr) },
                      { label: "Total additional expenses", value: formatINR(breakdown.additionalInr) },
                    ]}
                    total={{ label: "Total landed cost", value: formatINR(landedCost.totalInr) }}
                  />
                  <KeyValueList
                    size="sm"
                    className="border-t border-border-subtle lg:border-t-0"
                    items={[
                      { label: "Total received (stocked) quantity", value: `${formatNumber(landedCost.stockedPieces)} pieces` },
                      { label: "Landed cost per unit", value: inr(landedCost.perPieceInr, 2) },
                      { label: "Status", value: costStatus(landedCost) },
                    ]}
                  />
                </div>
                <Note>
                  The existing landed-cost engine, unchanged: supplier payments in INR at each payment&apos;s own rate, sea freight (agent payments, none on
                  CNF terms), and the order&apos;s allocated share of each container&apos;s clearing and transport totals, over the pieces stocked in India.
                  {!landedCost.final ? " Shown as an estimate: a component is still missing, so the total is not final." : ""}
                </Note>
              </>
            ) : (
              <NotVisible what="Landed costs" />
            )}
          </div>
        </SectionCard>

        {/* K. Timeline */}
        <SectionCard title="Timeline" titleGap="none" {...section("timeline")}>
          <Timeline
            size="sm"
            className="mt-3"
            items={timeline.map((step) => ({
              title: `${TIMELINE_LABEL[step.step]} · ${formatDate(step.on)}`,
              detail: `${step.detail}${step.at ? ` · recorded ${formatDateTime(step.at)}` : ""}${step.by ? ` by ${step.by}` : ""}`,
              marker: "check",
            }))}
          />
          <Note>Every step is a date a record holds; nothing is derived from the current status. Payments appear on the day they were paid.</Note>
        </SectionCard>

        {/* L. Documents */}
        <SectionCard title="Documents" titleGap="none" {...section("documents")}>
          <p className="mt-3 text-sm text-muted-foreground">
            This system does not store attachments. Purchase order documents, invoices, receipts, shipping documents and the bill of entry are kept
            outside it; the references recorded here are the bill of entry number, the LR number, the delivery note and payment references.
          </p>
        </SectionCard>
      </PageContainer>
    </>
  );
}
