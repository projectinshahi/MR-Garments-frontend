"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import Link from "next/link";

import { LinkPending } from "@/components/layout/navigation-progress";
import { DataTable } from "@/components/shared/data-table";
import { PoLink } from "@/components/shared/po-link";
import { StatusPill } from "@/components/shared/status-pill";
import { stageLabel } from "@/features/orders/order-status";
import { moneyOrDash } from "@/features/payments/money";
import type { OrderReportRow } from "@/lib/api/reports-types";
import { formatDate, formatINR, formatMoney, formatNumber, formatQty, formatRateInr } from "@/lib/formatters";

import { DOLLAR_COST_NOTE, dollarCostText } from "../dollar-cost";
import { paymentStatusLabel, rowStatus } from "./order-reports-file";

// The Order reports table (RPT-O2, docs/order-report.md): one row per order with its supplier name, items, ordered
// quantity per unit, currency, value, Dollar Cost, settled, outstanding, stage and status, and the link to the order's detailed
// report. Amounts in the row's currency. Sortable, paged by 10. Client-side because column definitions hold functions.

const PAYMENT_TONE = { awaiting_goods: "neutral", unpaid: "danger", partly: "warning", paid: "success" } as const;
const right = { align: "right" } as const;
// Table cells never wrap by default; these columns may, so thirteen columns fit a 1440 px page with every row's text.
const wrap = "whitespace-normal";
/** 6 px side padding (the table's is 10) on four narrow columns: room for the Dollar Cost column and the widest payment pill. */
const narrow = "px-1.5";
/** The detailed report under Reports (breadcrumb Reports › Order Report › PO). */
export const detailedReportHref = (po: string) => `/reports/orders/${encodeURIComponent(po)}`;

export function OrderReportsTable({ rows, today, linkPos }: { rows: OrderReportRow[]; today: string; linkPos: boolean }) {
  const money =
    (pick: (row: OrderReportRow) => number | null) =>
    ({ row }: { row: { original: OrderReportRow } }) =>
      moneyOrDash(pick(row.original), (v) => formatMoney(v, row.original.currency));
  const columns: ColumnDef<OrderReportRow>[] = [
    { accessorKey: "po", header: "PO Number", meta: { className: "w-[88px] font-bold" }, cell: ({ row }) => <PoLink po={row.original.po} linked={linkPos} /> },
    { accessorKey: "orderDate", header: "Order Date", meta: { className: "w-[92px]" }, cell: ({ row }) => formatDate(row.original.orderDate) },
    {
      id: "supplier",
      accessorFn: (row) => row.supplier.name,
      header: "Supplier",
      meta: { className: `w-[100px] ${wrap}` },
    },
    { accessorKey: "lineCount", header: "Items", meta: { ...right, className: `w-[56px] ${wrap} ${narrow}` }, cell: ({ row }) => formatNumber(row.original.lineCount) },
    {
      // Pieces and metres never compare, so this column does not sort.
      id: "quantity",
      enableSorting: false,
      header: "Total Quantity",
      meta: { ...right, className: `w-[92px] ${wrap} ${narrow}` },
      cell: ({ row }) => row.original.quantities.map((total) => formatQty(total.quantity, total.unit)).join(" · ") || "–",
    },
    {
      // The rate saved on the order under its currency; "–" for orders placed before rates were kept.
      accessorKey: "currency",
      header: "Currency",
      meta: { className: `w-[76px] ${wrap} ${narrow}` },
      cell: ({ row }) => (
        <span className="flex flex-col leading-[18px]">
          <span>{row.original.currency}</span>
          <span className="text-[12.5px] text-muted-foreground">{row.original.exchangeRate === null ? "–" : `@ ${formatRateInr(row.original.exchangeRate)}`}</span>
        </span>
      ),
    },
    {
      accessorKey: "orderValueCny",
      header: "Value (received)",
      meta: { ...right, className: `w-[100px] ${wrap}` },
      // The INR value at the order's own rate under the amount (none without a rate).
      cell: ({ row }) => (
        <span className="inline-flex flex-col items-end leading-[18px]">
          {formatMoney(row.original.orderValueCny, row.original.currency)}
          {row.original.orderValueInr === null || row.original.currency === "INR" ? null : <span className="text-[12.5px] text-muted-foreground">{formatINR(row.original.orderValueInr)}</span>}
          <span className="text-[12.5px] text-muted-foreground">PO {formatMoney(row.original.poValueCny, row.original.currency)}</span>
        </span>
      ),
    },
    {
      // The order value in USD (the API's dollarCost); a non-USD order with goods received has no USD rate saved.
      accessorKey: "dollarCost",
      header: "Dollar Cost",
      meta: { ...right, className: `w-[76px] ${wrap} ${narrow}` },
      cell: ({ row }) =>
        row.original.dollarCost === null ? (
          <span className="text-[12.5px] leading-4 text-muted-foreground" title={DOLLAR_COST_NOTE}>
            {dollarCostText(null)}
          </span>
        ) : (
          dollarCostText(row.original.dollarCost)
        ),
    },
    {
      // What the supplier's account settled of the order (the ledger's FIFO projection) and its payment status.
      accessorKey: "settledCny",
      header: "Settled",
      meta: { ...right, className: `w-[92px] ${wrap}` },
      cell: ({ row }) => (
        <span className="inline-flex flex-col items-end">
          {moneyOrDash(row.original.settledCny, (v) => formatMoney(v, row.original.currency))}
          {row.original.held ? (
            <StatusPill tone="neutral">Pending review</StatusPill>
          ) : row.original.paymentStatus ? (
            <StatusPill tone={PAYMENT_TONE[row.original.paymentStatus]}>{paymentStatusLabel(row.original)}</StatusPill>
          ) : null}
        </span>
      ),
    },
    // Never below 0 by construction (the projection); "–" while held or not posted.
    { accessorKey: "outstandingCny", header: "Outstanding", meta: { ...right, className: `w-[84px] ${wrap}` }, cell: money((row) => row.outstandingCny) },
    { accessorKey: "stage", header: "Order Stage", meta: { className: `w-[88px] ${wrap}` }, cell: ({ row }) => stageLabel(row.original.stage) },
    {
      id: "status",
      accessorFn: (row) => rowStatus(row, today).label,
      header: "Status",
      meta: { className: `w-[92px] ${wrap}` },
      cell: ({ row }) => {
        const status = rowStatus(row.original, today);
        return <StatusPill tone={status.tone}>{status.label}</StatusPill>;
      },
    },
    {
      id: "report",
      enableSorting: false,
      header: "Actions",
      meta: { className: `w-[64px] ${wrap}`, align: "center" },
      // The eye opens the detailed report (the Suppliers list's icon actions); its accessible name keeps the PO.
      cell: ({ row }) => (
        <Link
          href={detailedReportHref(row.original.po)}
          aria-label={`Report: ${row.original.po}`}
          title="View detailed report"
          className="inline-flex size-8 items-center justify-center rounded-md text-primary outline-none hover:bg-info-soft focus-visible:ring-3 focus-visible:ring-ring/50 [&>svg]:size-4"
        >
          <Eye />
          <LinkPending />
        </Link>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      density="loose"
      size="sm"
      header="tall"
      padding="tight"
      sortable
      pagination={{ pageSize: 10, itemLabel: "orders", pageSizeOptions: [10, 25, 50] }}
      emptyState="No orders match these filters."
    />
  );
}
