"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import Link from "next/link";

import { LinkPending } from "@/components/layout/navigation-progress";
import { DataTable } from "@/components/shared/data-table";
import { PoLink } from "@/components/shared/po-link";
import { StatusPill } from "@/components/shared/status-pill";
import { stageLabel } from "@/features/orders/order-status";
import type { OrderReportRow } from "@/lib/api/reports-types";
import { formatDate, formatINR, formatMoney, formatNumber, formatQty, formatRateInr } from "@/lib/formatters";

import { PAYMENT_STATE_LABEL, rowStatus } from "./order-reports-file";

// The Order reports table (RPT-O2, docs/order-report.md): one row per order with its supplier (name and code), items,
// ordered quantity per unit, currency, PO value, paid, balance, stage and status, and the link to the order's detailed
// report. Amounts in the row's currency. Sortable, paged by 10. Client-side because column definitions hold functions.

const PAYMENT_TONE = { unpaid: "danger", partly: "warning", paid: "success" } as const;
const right = { align: "right" } as const;
// Table cells never wrap by default; these columns may, so twelve columns fit a 1440 px page with every row's text.
const wrap = "whitespace-normal";
/** The detailed report under Reports (breadcrumb Reports › Order Report › PO). */
export const detailedReportHref = (po: string) => `/reports/orders/${encodeURIComponent(po)}`;

export function OrderReportsTable({ rows, today, linkPos }: { rows: OrderReportRow[]; today: string; linkPos: boolean }) {
  const money = (pick: (row: OrderReportRow) => number) => ({ row }: { row: { original: OrderReportRow } }) => formatMoney(pick(row.original), row.original.currency);
  const columns: ColumnDef<OrderReportRow>[] = [
    { accessorKey: "po", header: "PO Number", meta: { className: "w-[88px] font-bold" }, cell: ({ row }) => <PoLink po={row.original.po} linked={linkPos} /> },
    { accessorKey: "orderDate", header: "Order Date", meta: { className: "w-[92px]" }, cell: ({ row }) => formatDate(row.original.orderDate) },
    {
      id: "supplier",
      accessorFn: (row) => row.supplier.name,
      header: "Supplier",
      meta: { className: `w-[150px] ${wrap}` },
      cell: ({ row }) => (
        <span className="flex flex-col leading-[18px]">
          <span>{row.original.supplier.name}</span>
          <span className="text-[12.5px] text-muted-foreground">{row.original.supplier.code || "–"}</span>
        </span>
      ),
    },
    { accessorKey: "lineCount", header: "Items", meta: { ...right, className: `w-[56px] ${wrap}` }, cell: ({ row }) => formatNumber(row.original.lineCount) },
    {
      // Pieces and metres never compare, so this column does not sort.
      id: "quantity",
      enableSorting: false,
      header: "Total Quantity",
      meta: { ...right, className: `w-[104px] ${wrap}` },
      cell: ({ row }) => row.original.quantities.map((total) => formatQty(total.quantity, total.unit)).join(" · ") || "–",
    },
    {
      // The rate saved on the order under its currency; "–" for orders placed before rates were kept.
      accessorKey: "currency",
      header: "Currency",
      meta: { className: `w-[84px] ${wrap}` },
      cell: ({ row }) => (
        <span className="flex flex-col leading-[18px]">
          <span>{row.original.currency}</span>
          <span className="text-[12.5px] text-muted-foreground">{row.original.exchangeRate === null ? "–" : `@ ${formatRateInr(row.original.exchangeRate)}`}</span>
        </span>
      ),
    },
    {
      accessorKey: "orderValueCny",
      header: "PO Value",
      meta: { ...right, className: `w-[104px] ${wrap}` },
      // The INR value at the order's own rate under the amount (none without a rate).
      cell: ({ row }) => (
        <span className="inline-flex flex-col items-end leading-[18px]">
          {formatMoney(row.original.orderValueCny, row.original.currency)}
          {row.original.orderValueInr === null || row.original.currency === "INR" ? null : <span className="text-[12.5px] text-muted-foreground">{formatINR(row.original.orderValueInr)}</span>}
        </span>
      ),
    },
    {
      accessorKey: "paidCny",
      header: "Paid Amount",
      meta: { ...right, className: `w-[96px] ${wrap}` },
      cell: ({ row }) => (
        <span className="inline-flex flex-col items-end">
          {formatMoney(row.original.paidCny, row.original.currency)}
          <StatusPill tone={PAYMENT_TONE[row.original.paymentStatus]}>{PAYMENT_STATE_LABEL[row.original.paymentStatus]}</StatusPill>
        </span>
      ),
    },
    { accessorKey: "balanceCny", header: "Balance", meta: { ...right, className: `w-[84px] ${wrap}` }, cell: money((row) => row.balanceCny) },
    { accessorKey: "stage", header: "Order Stage", meta: { className: `w-[108px] ${wrap}` }, cell: ({ row }) => stageLabel(row.original.stage) },
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
