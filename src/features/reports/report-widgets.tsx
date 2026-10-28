"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { BarChart } from "@/components/shared/bar-chart";
import { DataTable } from "@/components/shared/data-table";
import { StatusPill } from "@/components/shared/status-pill";
import { formatCNY, formatINR, formatNumber, formatQty, formatShortDate } from "@/lib/formatters";

import type { LandedCostByMonthReport, OrderedVsReceivedReport, OrderStatusReport, PaymentsPerSupplierReport } from "./data/queries";
import { monthLabel } from "./report-logic";

// Tables and the INR chart of the reports. Client-side because column definitions and value formatters are
// functions. Column widths place each column where its reference has it; one column per table takes the rest.

const DASH = "–";
const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

type LateOrder = OrderStatusReport["late"][number];

/** "Late orders" (33): bordered table inside the card. */
export function LateOrdersTable({ rows }: { rows: LateOrder[] }) {
  const columns: ColumnDef<LateOrder>[] = [
    { accessorKey: "po", header: "PO", meta: { className: "w-[105px] font-bold" } },
    { accessorKey: "supplier", header: "Supplier" },
    { accessorKey: "due", header: "Due", meta: { className: "w-[91px]" }, cell: ({ row }) => formatShortDate(row.original.due) },
    {
      accessorKey: "lateDays",
      header: "Late by",
      meta: { className: "w-[105px]" },
      cell: ({ row }) => <StatusPill tone="danger">{days(row.original.lateDays)}</StatusPill>,
    },
  ];
  return <DataTable columns={columns} data={rows} getRowId={(row) => row.orderId} size="sm" header="tall" />;
}

type ReceivedLine = OrderedVsReceivedReport["lines"][number];

/** Ordered vs received (35): short is red and bold above zero; payment Reduced (something short) or Full. */
export function ReceivedTable({ lines }: { lines: ReceivedLine[] }) {
  const columns: ColumnDef<ReceivedLine>[] = [
    { accessorKey: "po", header: "PO", meta: { className: "w-[115px] font-bold" } },
    { accessorKey: "supplier", header: "Supplier", meta: { className: "w-[234px]" } },
    { accessorKey: "item", header: "Item", meta: { className: "w-[155px]" } },
    { accessorKey: "ordered", header: "Ordered", cell: ({ row }) => formatQty(row.original.ordered, row.original.unit) },
    {
      accessorKey: "received",
      header: "Received",
      meta: { align: "right", className: "w-[123px]" },
      cell: ({ row }) => formatQty(row.original.received, row.original.unit),
    },
    {
      accessorKey: "short",
      header: "Short",
      meta: { align: "right", className: "w-[98px]" },
      cell: ({ row }) => (row.original.short > 0 ? <span className="font-bold text-danger">{formatQty(row.original.short, row.original.unit)}</span> : "0"),
    },
    {
      accessorKey: "shortValueCny",
      header: "Value of short",
      meta: { align: "right", className: "w-[152px]" },
      cell: ({ row }) => (row.original.shortValueCny === null ? DASH : formatCNY(row.original.shortValueCny)),
    },
    {
      id: "payment",
      header: "Payment",
      meta: { className: "w-[134px]" },
      cell: ({ row }) => (row.original.short > 0 ? <StatusPill tone="danger">Reduced</StatusPill> : <StatusPill tone="success">Full</StatusPill>),
    },
  ];
  return <DataTable columns={columns} data={lines} getRowId={(row) => row.orderLineId} size="sm" header="tall" />;
}

type SupplierRow = PaymentsPerSupplierReport["suppliers"][number];

/** Payments per supplier (37), with the totals row. */
export function SupplierPaymentsTable({ rows, totals }: Pick<PaymentsPerSupplierReport, "totals"> & { rows: SupplierRow[] }) {
  const columns: ColumnDef<SupplierRow>[] = [
    { accessorKey: "supplier", header: "Supplier", meta: { className: "w-[287px] font-bold" }, footer: "Total" },
    { id: "orders", header: "Orders", cell: ({ row }) => row.original.orders.join(", "), footer: `${totals.orders} open order${totals.orders === 1 ? "" : "s"}` },
    {
      accessorKey: "orderValueCny",
      header: "Order value",
      meta: { align: "right", className: "w-[146px]" },
      cell: ({ row }) => formatCNY(row.original.orderValueCny),
      footer: formatCNY(totals.orderValueCny),
    },
    {
      accessorKey: "paidCny",
      header: "Paid",
      meta: { align: "right", className: "w-[146px]" },
      cell: ({ row }) => formatCNY(row.original.paidCny),
      footer: formatCNY(totals.paidCny),
    },
    {
      accessorKey: "paidInr",
      header: "Paid in INR",
      meta: { align: "right", className: "w-[160px]" },
      cell: ({ row }) => formatINR(row.original.paidInr),
      footer: formatINR(totals.paidInr),
    },
    {
      accessorKey: "balanceCny",
      header: "Balance",
      meta: { align: "right", className: "w-[145px]" },
      cell: ({ row }) => formatCNY(row.original.balanceCny),
      footer: formatCNY(totals.balanceCny),
    },
  ];
  return <DataTable columns={columns} data={rows} getRowId={(row) => row.supplierId} density="snug" size="sm" header="tall" />;
}

type MonthCost = LandedCostByMonthReport["months"][number];
const perPieceLabel = (value: number | null) => (value === null ? DASH : formatINR(value, 2));

/** "By month" (38), with the totals row. */
export function MonthTable({ months, totals }: Pick<LandedCostByMonthReport, "months" | "totals">) {
  const columns: ColumnDef<MonthCost>[] = [
    {
      accessorKey: "month",
      header: "Month",
      cell: ({ row }) => `${monthLabel(row.original.month)}${row.original.soFar ? " (so far)" : ""}`,
      footer: "Total",
    },
    {
      accessorKey: "pieces",
      header: "Pieces",
      meta: { align: "right", className: "w-[120px]" },
      cell: ({ row }) => formatNumber(row.original.pieces),
      footer: formatNumber(totals.pieces),
    },
    {
      accessorKey: "landedCostInr",
      header: "Landed cost",
      meta: { align: "right", className: "w-[135px]" },
      cell: ({ row }) => (row.original.landedCostInr > 0 ? formatINR(row.original.landedCostInr) : DASH),
      footer: formatINR(totals.landedCostInr),
    },
    {
      accessorKey: "perPieceInr",
      header: "Per piece",
      meta: { align: "right", className: "w-[110px]" },
      cell: ({ row }) => perPieceLabel(row.original.perPieceInr),
      footer: perPieceLabel(totals.perPieceInr),
    },
  ];
  return <DataTable columns={columns} data={months} getRowId={(row) => row.month} density="snug" size="sm" header="tall" />;
}

/** "Landed cost by month" bars (38), with ₹ value labels. */
export function LandedCostChart({ months, className }: { months: MonthCost[]; className?: string }) {
  return (
    <BarChart
      label="Landed cost by month"
      data={months.map((m) => ({ label: monthLabel(m.month), value: m.landedCostInr }))}
      formatValue={(value) => formatINR(value)}
      className={className}
    />
  );
}
