"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/shared/data-table";
import { StatusPill } from "@/components/shared/status-pill";
import type { OrderView } from "@/features/order-detail/data/queries";
import { balanceOf } from "@/features/receiving/receiving-logic";
import { formatNumber, formatQty } from "@/lib/formatters";

type Line = OrderView["lines"][number];

/** Still to receive (never negative), or what came in above the ordered quantity. */
function Remaining({ line }: { line: Line }) {
  const { remaining, over } = balanceOf(line.quantity, line.received);
  if (over > 0) return <StatusPill tone="info">Over-received {formatNumber(over)}</StatusPill>;
  return <StatusPill tone={remaining > 0 ? "danger" : "success"}>{formatNumber(remaining)}</StatusPill>;
}

// Every receipt so far, per order line (lines can be counted in different units).
const columns: ColumnDef<Line>[] = [
  { id: "item", header: "Item", cell: ({ row }) => row.original.item.name },
  { id: "ordered", header: "Ordered", cell: ({ row }) => formatQty(row.original.quantity, row.original.unit), meta: { align: "right" } },
  { id: "received", header: "Received", cell: ({ row }) => formatQty(row.original.received, row.original.unit), meta: { align: "right" } },
  { id: "remaining", header: "Remaining", cell: ({ row }) => <Remaining line={row.original} />, meta: { align: "right" } },
];

export function ReceivingTable({ lines, className }: { lines: Line[]; className?: string }) {
  return <DataTable columns={columns} data={lines} getRowId={(line) => line.id} density="snug" size="sm" className={className} />;
}
