"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/shared/data-table";
import { StatusPill } from "@/components/shared/status-pill";
import type { OrderView } from "@/features/order-detail/data/queries";
import { formatNumber, formatQty } from "@/lib/formatters";

type Line = OrderView["lines"][number];
const short = (line: Line) => line.quantity - line.received;

// Every receipt so far, per order line (lines can be counted in different units).
const columns: ColumnDef<Line>[] = [
  { id: "item", header: "Item", cell: ({ row }) => row.original.item.name },
  { id: "ordered", header: "Ordered", cell: ({ row }) => formatQty(row.original.quantity, row.original.unit), meta: { align: "right" } },
  { id: "received", header: "Received", cell: ({ row }) => formatQty(row.original.received, row.original.unit), meta: { align: "right" } },
  {
    id: "short",
    header: "Short",
    cell: ({ row }) => <StatusPill tone={short(row.original) > 0 ? "danger" : "success"}>{formatNumber(short(row.original))}</StatusPill>,
    meta: { align: "right" },
  },
];

export function ReceivingTable({ lines, className }: { lines: Line[]; className?: string }) {
  return <DataTable columns={columns} data={lines} getRowId={(line) => line.id} density="snug" size="sm" className={className} />;
}
