"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/shared/data-table";
import { StatusPill } from "@/components/shared/status-pill";
import { formatINR, formatShortDate } from "@/lib/formatters";

import type { ContainerRow, DeliveryRow, PaymentDueRow } from "./data/queries";

// Column widths put each column where 04_2_Dashboard.jpeg has it; the last column takes the rest.

const deliveryColumns: ColumnDef<DeliveryRow>[] = [
  { accessorKey: "po", header: "PO", meta: { className: "w-[88px]" } },
  { accessorKey: "supplier", header: "Supplier", meta: { className: "w-[203px]" } },
  { accessorKey: "due", header: "Due date", meta: { className: "w-[86px]" }, cell: ({ row }) => formatShortDate(row.original.due) },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusPill tone={row.original.tone}>{row.original.status}</StatusPill>,
  },
];

const paymentColumns: ColumnDef<PaymentDueRow>[] = [
  { accessorKey: "supplier", header: "Supplier", meta: { className: "w-[183px]" } },
  { accessorKey: "po", header: "PO", meta: { className: "w-[82px]" } },
  { accessorKey: "payment", header: "Payment", meta: { className: "w-[77px]" } },
  { accessorKey: "due", header: "Due", meta: { className: "w-[80px]" }, cell: ({ row }) => formatShortDate(row.original.due) },
  { accessorKey: "amount", header: "Amount (INR)", meta: { align: "right" }, cell: ({ row }) => formatINR(row.original.amount) },
];

const containerColumns: ColumnDef<ContainerRow>[] = [
  { accessorKey: "container", header: "Container", meta: { className: "w-[173px]" } },
  { accessorKey: "agent", header: "Agent", meta: { className: "w-[157px]" } },
  { accessorKey: "terms", header: "Terms", meta: { className: "w-[77px]" } },
  { accessorKey: "etaIndia", header: "ETA India", cell: ({ row }) => formatShortDate(row.original.etaIndia) },
];

export function DeliveriesTable({ rows }: { rows: DeliveryRow[] }) {
  return <DataTable columns={deliveryColumns} data={rows} getRowId={(r) => r.po} density="dense" variant="plain" />;
}

export function PaymentsDueTable({ rows }: { rows: PaymentDueRow[] }) {
  return <DataTable columns={paymentColumns} data={rows} getRowId={(r) => `${r.po}-${r.payment}`} density="dense" variant="plain" />;
}

export function ContainersTable({ rows }: { rows: ContainerRow[] }) {
  return <DataTable columns={containerColumns} data={rows} getRowId={(r) => r.container} density="dense" variant="plain" />;
}
