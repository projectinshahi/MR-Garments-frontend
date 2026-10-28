"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/shared/data-table";
import type { OrderView } from "@/features/order-detail/data/queries";
import { formatCNY, formatQty } from "@/lib/formatters";

type Line = OrderView["lines"][number];

function columns(lines: Line[]): ColumnDef<Line>[] {
  // Quantities add up only when every line is counted in the same unit.
  const units = new Set(lines.map((line) => line.unit));
  const [unit] = units;
  const quantityTotal = units.size === 1 && unit ? formatQty(lines.reduce((sum, line) => sum + line.quantity, 0), unit) : null;
  return [
    { id: "item", header: "Item", cell: ({ row }) => row.original.item.name, footer: "Total", meta: { className: "font-bold" } },
    {
      accessorKey: "quantity",
      header: "Qty",
      cell: ({ row }) => formatQty(row.original.quantity, row.original.unit),
      footer: () => quantityTotal,
      meta: { align: "right" },
    },
    {
      accessorKey: "rateCny",
      header: "Rate",
      cell: ({ row }) => `${formatCNY(row.original.rateCny, { decimals: 2 })} / ${row.original.unit}`,
      meta: { align: "right" },
    },
    {
      accessorKey: "valueCny",
      header: "Line total",
      cell: ({ row }) => formatCNY(row.original.valueCny),
      footer: () => formatCNY(lines.reduce((sum, line) => sum + line.valueCny, 0)),
      meta: { align: "right", className: "font-bold" },
    },
  ];
}

export function ItemsTable({ lines }: { lines: Line[] }) {
  return <DataTable columns={columns(lines)} data={lines} getRowId={(line) => line.id} density="snug" size="sm" />;
}
