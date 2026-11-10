"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import { LinkPending } from "@/components/layout/navigation-progress";
import { DataTable } from "@/components/shared/data-table";
import { StatusPill } from "@/components/shared/status-pill";
import type { SupplierInsightRow } from "@/lib/api/suppliers-types";
import { formatNumber } from "@/lib/formatters";

import { daysText, moneyText, rateText } from "./suppliers-logic";

// The dashboards' tables (backend docs/suppliers.md SUP-2). Client-side because column definitions hold functions.

const right = { align: "right" } as const;
const supplierHref = (row: SupplierInsightRow) => `/suppliers/${row.supplierId}`;

const supplierColumn: ColumnDef<SupplierInsightRow> = {
  accessorKey: "name",
  header: "Supplier",
  meta: { className: "font-bold" },
  cell: ({ row }) => (
    <Link href={supplierHref(row.original)} className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
      {row.original.name}
      <LinkPending />
    </Link>
  ),
};

/** On-time rate as a pill: green from 90%, amber from 70%, red below; a dash while nothing was delivered. */
function RatePill({ rate }: { rate: number | null }) {
  if (rate === null) return <>–</>;
  return <StatusPill tone={rate >= 90 ? "success" : rate >= 70 ? "warning" : "danger"}>{rateText(rate)}</StatusPill>;
}

/** Top-performing suppliers (Performance tab): the best on-time rates among suppliers that delivered. */
export function TopPerformersTable({ rows }: { rows: SupplierInsightRow[] }) {
  const columns: ColumnDef<SupplierInsightRow>[] = [
    { id: "rank", header: "#", meta: { className: "w-[48px]" }, cell: ({ row }) => formatNumber(row.index + 1) },
    supplierColumn,
    { accessorKey: "orders", header: "Orders", meta: right, cell: ({ row }) => formatNumber(row.original.orders) },
    { accessorKey: "onTimeRate", header: "On time", meta: right, cell: ({ row }) => <RatePill rate={row.original.onTimeRate} /> },
    { accessorKey: "completed", header: "Completed", meta: right, cell: ({ row }) => formatNumber(row.original.completed) },
    { accessorKey: "averageDeliveryDays", header: "Avg. delivery", meta: right, cell: ({ row }) => daysText(row.original.averageDeliveryDays) },
  ];
  return <DataTable columns={columns} data={rows} getRowId={(row) => row.supplierId} size="sm" header="tall" density="snug" emptyState="No deliveries recorded yet." />;
}

/** Supplier-wise purchase value and delivery record (Performance tab). */
export function PerformanceTable({ rows }: { rows: SupplierInsightRow[] }) {
  const columns: ColumnDef<SupplierInsightRow>[] = [
    { accessorKey: "code", header: "Code", meta: { className: "w-[100px] font-bold" } },
    supplierColumn,
    { accessorKey: "orders", header: "Orders", meta: right, cell: ({ row }) => formatNumber(row.original.orders) },
    { accessorKey: "completed", header: "Completed", meta: right, cell: ({ row }) => `${formatNumber(row.original.completed)} (${rateText(row.original.completionRate)})` },
    { accessorKey: "delivered", header: "Delivered", meta: right, cell: ({ row }) => formatNumber(row.original.delivered) },
    { accessorKey: "onTimeRate", header: "On time", meta: right, cell: ({ row }) => <RatePill rate={row.original.onTimeRate} /> },
    {
      accessorKey: "delayed",
      header: "Delayed",
      meta: right,
      cell: ({ row }) => (row.original.delayed > 0 ? <span className="font-bold text-danger">{formatNumber(row.original.delayed)}</span> : "0"),
    },
    { accessorKey: "averageDeliveryDays", header: "Avg. delivery", meta: right, cell: ({ row }) => daysText(row.original.averageDeliveryDays) },
    { id: "value", header: "Purchase value", meta: right, cell: ({ row }) => moneyText(row.original.value) },
    { id: "balance", header: "Balance", meta: right, cell: ({ row }) => moneyText(row.original.balance) },
  ];
  return <DataTable columns={columns} data={rows} getRowId={(row) => row.supplierId} size="sm" header="tall" density="snug" emptyState="No orders in this period." />;
}

/** Top suppliers by purchase value (Analytics tab): the first five of the value order. */
export function TopValueTable({ rows }: { rows: SupplierInsightRow[] }) {
  const columns: ColumnDef<SupplierInsightRow>[] = [
    { id: "rank", header: "#", meta: { className: "w-[48px]" }, cell: ({ row }) => formatNumber(row.index + 1) },
    supplierColumn,
    { accessorKey: "country", header: "Country", cell: ({ row }) => row.original.country || "–" },
    { accessorKey: "orders", header: "Orders", meta: right, cell: ({ row }) => formatNumber(row.original.orders) },
    { id: "value", header: "Purchase value", meta: right, cell: ({ row }) => moneyText(row.original.value) },
    { id: "balance", header: "Balance", meta: right, cell: ({ row }) => moneyText(row.original.balance) },
  ];
  return <DataTable columns={columns} data={rows.slice(0, 5)} getRowId={(row) => row.supplierId} size="sm" header="tall" density="snug" emptyState="No orders in this period." />;
}
