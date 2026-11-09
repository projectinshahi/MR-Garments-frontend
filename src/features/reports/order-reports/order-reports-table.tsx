"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import { LinkPending } from "@/components/layout/navigation-progress";
import { DataTable } from "@/components/shared/data-table";
import { orderHref, PoLink } from "@/components/shared/po-link";
import { StatusPill } from "@/components/shared/status-pill";
import type { OrderReportRow } from "@/lib/api/reports-types";
import { formatDate, formatINR, formatMoney, formatQty } from "@/lib/formatters";

import { PAYMENT_STATE_LABEL, rowStatus } from "./order-reports-file";

// The Order reports table (RPT-O2): one row per order, amounts in the row's currency, INR landed cost, and a Report
// link to the order's Report tab. Client-side because column definitions and value formatters are functions.

const DASH = "–";
const PAYMENT_TONE = { unpaid: "danger", partly: "warning", paid: "success" } as const;

export function OrderReportsTable({ rows, today, linkPos }: { rows: OrderReportRow[]; today: string; linkPos: boolean }) {
  const money = (pick: (row: OrderReportRow) => number) => ({ row }: { row: { original: OrderReportRow } }) => formatMoney(pick(row.original), row.original.currency);
  const columns: ColumnDef<OrderReportRow>[] = [
    { accessorKey: "po", header: "PO", cell: ({ row }) => <PoLink po={row.original.po} linked={linkPos} /> },
    { id: "supplier", header: "Supplier", cell: ({ row }) => row.original.supplier.name },
    { accessorKey: "orderDate", header: "Order date", cell: ({ row }) => formatDate(row.original.orderDate) },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = rowStatus(row.original, today);
        return <StatusPill tone={status.tone}>{status.label}</StatusPill>;
      },
    },
    { accessorKey: "quantity", header: "Ordered", meta: { align: "right" }, cell: ({ row }) => formatQty(row.original.quantity, row.original.unit) },
    { accessorKey: "received", header: "Received", meta: { align: "right" }, cell: ({ row }) => formatQty(row.original.received, row.original.unit) },
    { accessorKey: "stocked", header: "Stocked", meta: { align: "right" }, cell: ({ row }) => formatQty(row.original.stocked, row.original.unit) },
    { accessorKey: "orderValueCny", header: "Order value", meta: { align: "right" }, cell: money((row) => row.orderValueCny) },
    {
      accessorKey: "paidCny",
      header: "Paid",
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="inline-flex flex-col items-end">
          {formatMoney(row.original.paidCny, row.original.currency)}
          <StatusPill tone={PAYMENT_TONE[row.original.paymentStatus]}>{PAYMENT_STATE_LABEL[row.original.paymentStatus]}</StatusPill>
        </span>
      ),
    },
    { accessorKey: "balanceCny", header: "Balance", meta: { align: "right" }, cell: money((row) => row.balanceCny) },
    { accessorKey: "landedCostInr", header: "Landed cost", meta: { align: "right" }, cell: ({ row }) => (row.original.landedCostInr === null ? DASH : formatINR(row.original.landedCostInr)) },
    { accessorKey: "perPieceInr", header: "Per piece", meta: { align: "right" }, cell: ({ row }) => (row.original.perPieceInr === null ? DASH : formatINR(row.original.perPieceInr, 2)) },
    {
      id: "report",
      header: "",
      cell: ({ row }) =>
        linkPos ? (
          <Link href={`${orderHref(row.original.po)}/report`} aria-label={`Report: ${row.original.po}`} className="rounded-sm font-bold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
            Report
            <LinkPending />
          </Link>
        ) : null,
    },
  ];
  return <DataTable columns={columns} data={rows} getRowId={(row) => row.id} density="loose" size="sm" header="tall" emptyState="No orders match these filters." />;
}
