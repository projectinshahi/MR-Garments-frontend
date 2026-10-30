"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/shared/data-table";
import type { OrderView } from "@/features/order-detail/data/queries";
import { formatMoney, formatQty } from "@/lib/formatters";
import type { Currency } from "@/types/domain";

type Line = OrderView["lines"][number];

/** Rates and line totals are in the order's `currency`. */
function columns(lines: Line[], currency: Currency): ColumnDef<Line>[] {
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
      cell: ({ row }) => `${formatMoney(row.original.rateCny, currency, { decimals: 2 })} / ${row.original.unit}`,
      meta: { align: "right" },
    },
    {
      accessorKey: "valueCny",
      header: "Line total",
      cell: ({ row }) => formatMoney(row.original.valueCny, currency),
      footer: () => formatMoney(lines.reduce((sum, line) => sum + line.valueCny, 0), currency),
      meta: { align: "right", className: "font-bold" },
    },
  ];
}

export function ItemsTable({ lines, currency }: { lines: Line[]; currency: Currency }) {
  return <DataTable columns={columns(lines, currency)} data={lines} getRowId={(line) => line.id} density="snug" size="sm" />;
}
