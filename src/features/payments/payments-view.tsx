"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { CardNote, SectionCard } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/filters";
import { PoLink } from "@/components/shared/po-link";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { PLAIN_ACTIONS_COLUMN_CLASS } from "@/features/order-detail/shared/delete-record";
import { ReportDownload } from "@/features/reports/report-actions";
import type { LedgerTotal } from "@/lib/api/ledger-types";
import type { OrderOptions } from "@/lib/api/types";
import { currencySymbol, formatDate, formatINR, formatMoney, formatNumber, formatRate, formatShortDate } from "@/lib/formatters";
import { todayInIndia } from "@/lib/today";
import type { Currency } from "@/types/domain";

import type { OrderPaymentRow, Payment } from "./data/queries";
import { EditPaymentButton } from "./edit-payment";
import { filterOrders, filterPayments } from "./filter-orders";
import { DASH, MilestonePill, moneyOrDash, PaymentStatusCell, PaymentStatusPill, paymentType } from "./money";
import { PaymentDetailCard } from "./payment-detail";
import { paymentsFile } from "./payment-files";
import { RecordPaymentDialog, type SupplierChoice } from "./record-payment-dialog";
import { VoidPaymentButton } from "./void-payment";

// 10 px cell padding as measured in 16_5_Deposits_&_Payments.jpeg; PO / Supplier takes the rest.
const PAD = "px-2.5 first:pl-2.5 last:pr-2.5";
const PAYMENTS_PAGE_SIZE = 10;
const head = (label: string) => <span className="block pt-1.5 text-xs">{label}</span>;

/**
 * Every payment, latest first: orderless supplier payments, legacy ones recorded against a PO (a memo), shipping-agent
 * ones (sea freight). A voided payment is struck through and flagged; it counts in no total.
 */
const paymentColumns = (linkPo: boolean, canVoid: boolean): ColumnDef<Payment>[] => [
  { id: "date", header: "Date", cell: ({ row }) => formatDate(row.original.paidOn ?? row.original.dueDate ?? row.original.recordedAt) },
  { accessorKey: "supplier", header: "Supplier" },
  {
    id: "order",
    header: "Order",
    cell: ({ row }) => (row.original.po ? <PoLink po={row.original.po} linked={linkPo} /> : <span className="text-muted-foreground">Supplier account</span>),
  },
  { accessorKey: "payee", header: "Paid to", cell: ({ row }) => (row.original.payeeRole === "agent" ? `${row.original.payee} (agent)` : row.original.payee) },
  { id: "type", header: "Type", cell: ({ row }) => paymentType(row.original) },
  {
    accessorKey: "amountCny",
    header: "Amount",
    meta: { align: "right" },
    cell: ({ row }) => <span className={row.original.voided ? "line-through" : undefined}>{formatMoney(row.original.amountCny, row.original.currency, { decimals: 2 })}</span>,
  },
  { accessorKey: "rateInr", header: "Rate", meta: { align: "right" }, cell: ({ row }) => (row.original.currency === "INR" || row.original.rateInr === null ? DASH : formatRate(row.original.rateInr)) },
  { accessorKey: "amountInr", header: "In INR", meta: { align: "right" }, cell: ({ row }) => moneyOrDash(row.original.amountInr, formatINR) },
  { id: "reference", header: "Mode · reference", cell: ({ row }) => [row.original.mode, row.original.reference].filter(Boolean).join(" · ") || DASH },
  { id: "status", header: "Status", cell: ({ row }) => <PaymentStatusCell payment={row.original} /> },
  ...(canVoid
    ? [
        {
          id: "actions",
          header: "Actions",
          meta: { className: `w-[96px] ${PLAIN_ACTIONS_COLUMN_CLASS}` },
          cell: ({ row }) => (
            <span className="flex gap-3">
              <EditPaymentButton payment={row.original} />
              <VoidPaymentButton payment={row.original} voided={row.original.voided} />
            </span>
          ),
        } satisfies ColumnDef<Payment>,
      ]
    : []),
];

/**
 * Payments by order, the API's FIFO figures: value, settled from the supplier's account, outstanding (never negative),
 * the payment status and the Deposit Required milestone. `currency`: the one currency of every order, shown in the
 * headers; null when they differ (each amount then shows its own symbol).
 */
const orderColumns = (currency: Currency | null): ColumnDef<OrderPaymentRow>[] => {
  const label = (text: string) => head(currency ? `${text} (${currencySymbol(currency)})` : text);
  const amount = (value: number | null, row: OrderPaymentRow) => moneyOrDash(value, (v) => (currency ? formatNumber(v, 2) : formatMoney(v, row.currency, { decimals: 2 })));
  return [
    {
      accessorKey: "po",
      header: () => head("PO / Supplier"),
      meta: { className: PAD },
      cell: ({ row }) => (
        <>
          {/* Focusable for keyboard users; Enter or Space bubbles a click to the row handler. */}
          <button type="button" className="block rounded-sm text-left leading-4 font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            {row.original.po}
          </button>
          <span className="block text-[12.5px] leading-4 font-bold text-muted-foreground">{row.original.supplier}</span>
        </>
      ),
    },
    { accessorKey: "orderValueCny", header: () => label("Order value (received)"), meta: { align: "right", className: PAD }, cell: ({ row }) => amount(row.original.orderValueCny, row.original) },
    { accessorKey: "settledCny", header: () => label("Settled"), meta: { align: "right", className: PAD }, cell: ({ row }) => amount(row.original.settledCny, row.original) },
    { accessorKey: "outstandingCny", header: () => label("Outstanding"), meta: { align: "right", className: PAD }, cell: ({ row }) => amount(row.original.outstandingCny, row.original) },
    {
      id: "status",
      header: () => head("Status"),
      meta: { className: PAD },
      cell: ({ row }) => (
        <span className="flex flex-col items-start gap-1">
          <PaymentStatusPill status={row.original.paymentStatus} held={row.original.held} />
          <MilestonePill status={row.original.depositStatus} />
        </span>
      ),
    },
    {
      accessorKey: "paidInr",
      header: () => (
        <span className="block text-xs leading-4">
          Paid (INR)
          <span className="block text-[11px] font-normal">goods + sea freight</span>
        </span>
      ),
      meta: { align: "right", className: PAD },
      cell: ({ row }) => moneyOrDash(row.original.paidInr, formatINR),
    },
    {
      accessorKey: "nextDue",
      header: () => head("Next due"),
      meta: { className: PAD },
      cell: ({ row }) => {
        const { nextDue, nextDueTone } = row.original;
        if (!nextDue) return "Not yet due";
        return nextDueTone ? <StatusPill tone={nextDueTone}>{formatShortDate(nextDue)}</StatusPill> : formatShortDate(nextDue);
      },
    },
  ];
};

type PaymentsViewProps = {
  orders: OrderPaymentRow[];
  payments: Payment[];
  /** The order selected on load; a row click selects another. */
  defaultPo: string | null;
  kpis: React.ReactNode;
  /** ADV-5's suppliers (payments Enter): Record payment; null without it. */
  suppliers: SupplierChoice[] | null;
  /** Shipping agents (payments Enter): Record sea freight payment; null without it. */
  agents: OrderOptions["agents"] | null;
  /** POs link to their order page (canOpen(me, "/orders")). */
  linkPo: boolean;
  /** Edit and Void on each payment (PAY-4, PAY-3: payments Full). */
  canVoid?: boolean;
  /** LED-2's per-currency totals, for the download's summary. */
  totals?: LedgerTotal[];
};

/**
 * Payments: the KPIs (a server slot), every payment, and payments by order with the selected order's card. The header
 * search filters both tables by PO or supplier (and a payment's reference).
 */
export function PaymentsView({ orders, payments, defaultPo, kpis, suppliers, agents, linkPo, canVoid = false, totals = [] }: PaymentsViewProps) {
  const [query, setQuery] = useState("");
  const [selectedPo, setSelectedPo] = useState(defaultPo);
  // The Payments table's page is kept here: the refresh after an Edit or Void sends new rows, and a table that owns its
  // page goes back to page 1 then, so the row just saved left the screen (a phone has no search box).
  const [page, setPage] = useState(0);
  const visible = filterOrders(orders, query);
  const shownPayments = filterPayments(payments, query);
  const paymentsPage = Math.min(page, Math.max(0, Math.ceil(shownPayments.length / PAYMENTS_PAGE_SIZE) - 1));
  const selected = visible.find((order) => order.po === selectedPo);
  const currencies = new Set(orders.map((order) => order.currency));
  const single = currencies.size > 1 ? null : ([...currencies][0] ?? "CNY");

  return (
    <>
      <PageHeader
        title="Payments"
        actions={
          <>
            <form role="search" className="hidden sm:block" onSubmit={(event) => event.preventDefault()}>
              <SearchInput
                size="sm"
                label="Search PO or supplier"
                placeholder="Search PO or supplier"
                value={query}
                onValueChange={(value) => {
                  setQuery(value);
                  setPage(0);
                }}
                className="w-[170px] lg:w-[250px]"
              />
            </form>
            <ReportDownload file={() => paymentsFile(visible, shownPayments, query, todayInIndia(), totals)} />
            {suppliers ? (
              <RecordPaymentDialog suppliers={suppliers} canApprove={canVoid}>
                <Button type="button" size="header">
                  + Record payment
                </Button>
              </RecordPaymentDialog>
            ) : null}
          </>
        }
      />
      <PageContainer>
        {kpis}
        <SectionCard title="Payments" aside={<CardNote size="sm">Latest first · voided payments are listed but count in no total</CardNote>} titleGap="none" className="min-w-0">
          <DataTable
            columns={paymentColumns(linkPo, canVoid)}
            data={shownPayments}
            getRowId={(payment) => payment.id}
            size="sm"
            header="tall"
            emptyState={payments.length ? "No payments match your search." : "No payments recorded yet."}
            pagination={{ pageSize: PAYMENTS_PAGE_SIZE, itemLabel: "payments", pageIndex: paymentsPage, onPageChange: setPage }}
            className="mt-2.5"
          />
        </SectionCard>
        <div className="grid items-start gap-(--page-gap) lg:grid-cols-[1.6fr_1fr]">
          <SectionCard
            title="Payments by order"
            aside={<CardNote size="sm">{single ? `Amounts in supplier currency (${currencySymbol(single)}) and INR` : "Amounts in each order's currency and INR"}</CardNote>}
            titleGap="none"
            className="min-w-0 pt-3.5 pb-[18px]"
          >
            <DataTable
              columns={orderColumns(single)}
              data={visible}
              getRowId={(row) => row.po}
              density="tall"
              variant="plain"
              selectedRowId={selectedPo ?? undefined}
              onRowClick={(row) => setSelectedPo(row.po)}
              emptyState={orders.length ? "No orders match your search." : "No orders yet."}
              className="mt-2.5"
            />
            <CardNote size="sm" className="mt-3 block">
              Supplier payments go to the supplier&apos;s account; each order is settled from it, oldest first. Sea freight is paid to agents on the order.
            </CardNote>
          </SectionCard>
          {selected ? (
            <PaymentDetailCard
              order={selected}
              // PAY-1 lists payments newest first; the card numbers them oldest first.
              payments={payments.filter((p) => p.po === selected.po).toReversed()}
              suppliers={suppliers}
              agents={agents}
              linkPo={linkPo}
              canVoid={canVoid}
            />
          ) : null}
        </div>
      </PageContainer>
    </>
  );
}
