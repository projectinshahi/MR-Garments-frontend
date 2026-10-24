"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/shared/data-table";
import { StatusPill } from "@/components/shared/status-pill";
import { formatNumber } from "@/lib/formatters";

import type { ReceivingRow } from "./data/queries";

const columns: ColumnDef<ReceivingRow>[] = [
  { accessorKey: "item", header: "Item" },
  { accessorKey: "ordered", header: "Ordered", cell: ({ row }) => formatNumber(row.original.ordered), meta: { align: "right" } },
  { accessorKey: "received", header: "Received", cell: ({ row }) => formatNumber(row.original.received), meta: { align: "right" } },
  {
    accessorKey: "short",
    header: "Short",
    cell: ({ row }) => (
      <StatusPill tone={row.original.short > 0 ? "danger" : "success"}>{formatNumber(row.original.short)}</StatusPill>
    ),
    meta: { align: "right" },
  },
];

export function ReceivingTable({ rows, className }: { rows: ReceivingRow[]; className?: string }) {
  return <DataTable columns={columns} data={rows} getRowId={(r) => r.item} density="snug" size="sm" className={className} />;
}
