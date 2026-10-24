"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/shared/data-table";
import { formatCNY, formatNumber, formatQty } from "@/lib/formatters";

import type { ItemRow, OrderItems } from "./data/queries";

function columns(totals: OrderItems["totals"]): ColumnDef<ItemRow>[] {
  return [
    { accessorKey: "item", header: "Item", footer: "Total", meta: { className: "font-bold" } },
    { accessorKey: "style", header: "Colour / style" },
    {
      accessorKey: "pieces",
      header: "Qty",
      cell: ({ row }) => formatQty(row.original.pieces, "pcs"),
      footer: () => formatQty(totals.pieces, "pcs"),
      meta: { align: "right" },
    },
    {
      accessorKey: "bundles",
      header: "Bundles",
      cell: ({ row }) => formatNumber(row.original.bundles),
      footer: () => formatNumber(totals.bundles),
      meta: { align: "right" },
    },
    {
      accessorKey: "pricePerPiece",
      header: "Price per piece",
      cell: ({ row }) => formatCNY(row.original.pricePerPiece, { decimals: 2 }),
      meta: { align: "right" },
    },
    {
      accessorKey: "lineTotal",
      header: "Line total",
      cell: ({ row }) => formatCNY(row.original.lineTotal),
      footer: () => formatCNY(totals.value),
      meta: { align: "right", className: "font-bold" },
    },
  ];
}

export function ItemsTable({ rows, totals }: { rows: ItemRow[]; totals: OrderItems["totals"] }) {
  return <DataTable columns={columns(totals)} data={rows} getRowId={(r) => r.item} density="snug" size="sm" />;
}
