"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/shared/data-table";
import { formatINR, formatNumber } from "@/lib/formatters";

import type { TeamShare } from "./data/queries";

type TeamRow = TeamShare & { costPerPiece: number };

const sum = (rows: { original: TeamRow }[], pick: (row: TeamRow) => number) => rows.reduce((total, row) => total + pick(row.original), 0);
const percent = (part: number, whole: number) => `${Math.round((part / whole) * 100)}%`;

// Widths put each right-aligned column where 12_3.1.g_Warehouse.jpeg has it; Team takes the rest.
const columns: ColumnDef<TeamRow>[] = [
  { accessorKey: "team", header: "Team", footer: "Total" },
  {
    accessorKey: "pieces",
    header: "Pieces",
    meta: { align: "right", className: "w-[120px]" },
    cell: ({ row }) => formatNumber(row.original.pieces),
    footer: ({ table }) => formatNumber(sum(table.getCoreRowModel().rows, (r) => r.pieces)),
  },
  {
    id: "share",
    header: "Share",
    meta: { align: "right", className: "w-[91px]" },
    cell: ({ row, table }) => percent(row.original.pieces, sum(table.getCoreRowModel().rows, (r) => r.pieces)),
    footer: "100%",
  },
  {
    accessorKey: "costPerPiece",
    header: "Cost per piece",
    meta: { align: "right", className: "w-[163px]" },
    cell: ({ row }) => formatINR(row.original.costPerPiece, 2),
    footer: ({ table }) => {
      const rows = table.getCoreRowModel().rows;
      return formatINR(sum(rows, (r) => r.pieces * r.costPerPiece) / sum(rows, (r) => r.pieces), 2);
    },
  },
  {
    id: "cost",
    header: "Cost",
    meta: { align: "right", className: "w-[136px]" },
    cell: ({ row }) => <span className="font-bold">{formatINR(row.original.pieces * row.original.costPerPiece)}</span>,
    footer: ({ table }) => formatINR(sum(table.getCoreRowModel().rows, (r) => r.pieces * r.costPerPiece)),
  },
];

/** "Given to teams": pieces, share and landed cost per team, with the total row. */
export function TeamsTable({ teams, costPerPiece }: { teams: TeamShare[]; costPerPiece: number }) {
  return <DataTable columns={columns} data={teams.map((team) => ({ ...team, costPerPiece }))} getRowId={(row) => row.team} density="snug" size="sm" />;
}
