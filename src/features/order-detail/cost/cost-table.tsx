"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/shared/data-table";
import { formatINR, formatQty } from "@/lib/formatters";

import type { CostLine } from "./data/queries";

/** "Cost breakdown": every cost part in INR and per piece, with the landed-cost total row. */
export function CostTable({ lines, pieces, total }: { lines: CostLine[]; pieces: number; total: number }) {
  // Widths put each column where 13_3.1.h_Cost.jpeg has it; Detail takes the rest.
  const columns: ColumnDef<CostLine>[] = [
    { accessorKey: "part", header: "Cost part", meta: { className: "w-[157px]" }, footer: "Landed cost" },
    { accessorKey: "detail", header: "Detail", footer: formatQty(pieces, "pcs") },
    {
      accessorKey: "amount",
      header: "Amount (INR)",
      meta: { align: "right", className: "w-[150px]" },
      cell: ({ row }) => formatINR(row.original.amount),
      footer: formatINR(total),
    },
    {
      id: "perPiece",
      header: "Per piece",
      meta: { align: "right", className: "w-[106px]" },
      cell: ({ row }) => formatINR(row.original.amount / pieces, 2),
      footer: formatINR(total / pieces, 2),
    },
  ];
  return <DataTable columns={columns} data={lines} density="snug" size="sm" />;
}
