"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { BarChart } from "@/components/shared/bar-chart";
import { DataTable } from "@/components/shared/data-table";
import { StatusPill } from "@/components/shared/status-pill";
import { formatCNY, formatINR, formatNumber, formatQty, formatShortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import type { LateOrder, MonthCost, RecentDownload, ReceivedLine, SupplierPayment } from "./data/queries";
import { balance, monthTotals, shortQty, supplierTotals } from "./report-logic";

// Tables and the INR chart of the reports. Client-side because column definitions and value formatters are
// functions. Column widths place each column where its reference has it; one column per table takes the rest.

// The bordered report tables (33, 35, 37, 38) have a 38 px header row plus its rule (DataTable size="sm" draws 34 px).
const HEAD = "h-[39px]";
const DASH = "–";

/** "Recently downloaded" on the hub (32): 12 px headers low in a 43 px row, 13.5 px cells, 10 px outer padding. */
export function RecentDownloadsTable({ rows }: { rows: RecentDownload[] }) {
  const cell = "h-[43px] first:pl-2.5 last:pr-2.5";
  const columns: ColumnDef<RecentDownload>[] = [
    { accessorKey: "report", header: "Report", meta: { className: cn(cell, "w-[350px] font-bold") } },
    { accessorKey: "period", header: "Period", meta: { className: cn(cell, "w-[203px]") } },
    {
      accessorKey: "format",
      header: "Format",
      meta: { className: cn(cell, "w-[125px]") },
      cell: ({ row }) => <StatusPill tone="info">{row.original.format}</StatusPill>,
    },
    { accessorKey: "by", header: "Downloaded by", meta: { className: cell } },
    { accessorKey: "when", header: "When", meta: { align: "right", className: cn(cell, "w-[150px]") } },
  ];
  return <DataTable columns={columns} data={rows} getRowId={(row) => row.id} density="dense" variant="plain" />;
}

/** "Late orders" (33): bordered table inside the card. */
export function LateOrdersTable({ rows }: { rows: LateOrder[] }) {
  const columns: ColumnDef<LateOrder>[] = [
    { accessorKey: "po", header: "PO", meta: { className: cn(HEAD, "w-[105px] font-bold") } },
    { accessorKey: "supplier", header: "Supplier", meta: { className: HEAD } },
    { accessorKey: "due", header: "Due", meta: { className: cn(HEAD, "w-[91px]") }, cell: ({ row }) => formatShortDate(row.original.due) },
    {
      accessorKey: "lateBy",
      header: "Late by",
      meta: { className: cn(HEAD, "w-[105px]") },
      cell: ({ row }) => <StatusPill tone="danger">{row.original.lateBy}</StatusPill>,
    },
  ];
  return <DataTable columns={columns} data={rows} getRowId={(row) => row.po} size="sm" />;
}

/** Ordered vs received (35): short is red and bold above zero; payment Reduced or Full. */
export function ReceivedTable({ lines }: { lines: ReceivedLine[] }) {
  const columns: ColumnDef<ReceivedLine>[] = [
    { accessorKey: "po", header: "PO", meta: { className: cn(HEAD, "w-[115px] font-bold") } },
    { accessorKey: "supplier", header: "Supplier", meta: { className: cn(HEAD, "w-[234px]") } },
    { accessorKey: "item", header: "Item", meta: { className: cn(HEAD, "w-[155px]") } },
    { accessorKey: "ordered", header: "Ordered", meta: { className: HEAD }, cell: ({ row }) => formatQty(row.original.ordered, row.original.unit) },
    {
      accessorKey: "received",
      header: "Received",
      meta: { align: "right", className: cn(HEAD, "w-[123px]") },
      cell: ({ row }) => formatQty(row.original.received, row.original.unit),
    },
    {
      id: "short",
      header: "Short",
      meta: { align: "right", className: cn(HEAD, "w-[98px]") },
      cell: ({ row }) => {
        const short = shortQty(row.original);
        return short > 0 ? <span className="font-bold text-danger">{formatQty(short, row.original.unit)}</span> : "0";
      },
    },
    {
      accessorKey: "shortValue",
      header: "Value of short",
      meta: { align: "right", className: cn(HEAD, "w-[152px]") },
      cell: ({ row }) => (row.original.shortValue === null ? DASH : formatCNY(row.original.shortValue)),
    },
    {
      accessorKey: "payment",
      header: "Payment",
      meta: { className: cn(HEAD, "w-[134px]") },
      cell: ({ row }) => <StatusPill tone={row.original.payment === "Reduced" ? "danger" : "success"}>{row.original.payment}</StatusPill>,
    },
  ];
  return <DataTable columns={columns} data={lines} getRowId={(row) => row.po} size="sm" />;
}

/** Payments per supplier (37), with the totals row. */
export function SupplierPaymentsTable({ rows }: { rows: SupplierPayment[] }) {
  const totals = supplierTotals(rows);
  const columns: ColumnDef<SupplierPayment>[] = [
    { accessorKey: "supplier", header: "Supplier", meta: { className: cn(HEAD, "w-[287px] font-bold") }, footer: "Total" },
    { id: "orders", header: "Orders", meta: { className: HEAD }, cell: ({ row }) => row.original.orders.join(", "), footer: `${totals.orders} open orders` },
    {
      accessorKey: "orderValue",
      header: "Order value",
      meta: { align: "right", className: cn(HEAD, "w-[146px]") },
      cell: ({ row }) => formatCNY(row.original.orderValue),
      footer: formatCNY(totals.orderValue),
    },
    {
      accessorKey: "paid",
      header: "Paid",
      meta: { align: "right", className: cn(HEAD, "w-[146px]") },
      cell: ({ row }) => formatCNY(row.original.paid),
      footer: formatCNY(totals.paid),
    },
    {
      accessorKey: "paidInr",
      header: "Paid in INR",
      meta: { align: "right", className: cn(HEAD, "w-[160px]") },
      cell: ({ row }) => formatINR(row.original.paidInr),
      footer: formatINR(totals.paidInr),
    },
    {
      id: "balance",
      header: "Balance",
      meta: { align: "right", className: cn(HEAD, "w-[145px]") },
      cell: ({ row }) => formatCNY(balance(row.original)),
      footer: formatCNY(totals.balance),
    },
  ];
  return <DataTable columns={columns} data={rows} getRowId={(row) => row.supplier} density="snug" size="sm" />;
}

const perPieceLabel = (value: number | null) => (value === null ? DASH : formatINR(value, 2));

/** "By month" (38), with the totals row. */
export function MonthTable({ months }: { months: MonthCost[] }) {
  const totals = monthTotals(months);
  const columns: ColumnDef<MonthCost>[] = [
    {
      accessorKey: "month",
      header: "Month",
      meta: { className: HEAD },
      cell: ({ row }) => (row.original.soFar ? `${row.original.month} (so far)` : row.original.month),
      footer: "Total",
    },
    {
      accessorKey: "pieces",
      header: "Pieces",
      meta: { align: "right", className: cn(HEAD, "w-[120px]") },
      cell: ({ row }) => formatNumber(row.original.pieces),
      footer: formatNumber(totals.pieces),
    },
    {
      accessorKey: "landedCost",
      header: "Landed cost",
      meta: { align: "right", className: cn(HEAD, "w-[135px]") },
      cell: ({ row }) => (row.original.landedCost > 0 ? formatINR(row.original.landedCost) : DASH),
      footer: formatINR(totals.landedCost),
    },
    {
      id: "perPiece",
      header: "Per piece",
      meta: { align: "right", className: cn(HEAD, "w-[110px]") },
      cell: ({ row }) => perPieceLabel(row.original.perPiece),
      footer: perPieceLabel(totals.perPiece),
    },
  ];
  return <DataTable columns={columns} data={months} getRowId={(row) => row.month} density="snug" size="sm" />;
}

/** "Landed cost by month" bars (38), with ₹ value labels. */
export function LandedCostChart({ months, className }: { months: MonthCost[]; className?: string }) {
  return (
    <BarChart
      label="Landed cost by month"
      data={months.map((m) => ({ label: m.month, value: m.landedCost }))}
      formatValue={(value) => formatINR(value)}
      className={className}
    />
  );
}
