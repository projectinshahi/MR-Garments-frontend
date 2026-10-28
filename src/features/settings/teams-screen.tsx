"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { TeamRow } from "@/lib/api/types";
import { formatINR, formatNumber } from "@/lib/formatters";

import { bold, PrototypeAction, right, SettingsList } from "./settings-list";
import { averagePerPieceText } from "./settings-logic";

const teamColumns: ColumnDef<TeamRow>[] = [
  { accessorKey: "name", header: "Team", meta: bold },
  { accessorKey: "piecesInStock", header: "Pieces in stock", meta: right, cell: ({ row }) => formatNumber(row.original.piecesInStock) },
  {
    accessorKey: "landedCostOfStockInr",
    header: "Landed cost of stock",
    meta: right,
    cell: ({ row }) => formatINR(row.original.landedCostOfStockInr),
  },
  {
    accessorKey: "averagePerPieceInr",
    header: "Average per piece",
    meta: right,
    cell: ({ row }) => averagePerPieceText(row.original.averagePerPieceInr),
  },
];

/** 45_15.6_Teams.jpeg */
export function TeamsScreen({ rows }: { rows: TeamRow[] }) {
  return (
    <SettingsList
      path="/settings/teams"
      rows={rows}
      columns={teamColumns}
      searchText={(row) => [row.name]}
      noun="teams"
      footnote="Goods are split between these teams when they are received in the warehouse. Team names here are examples."
      action={<PrototypeAction label="Add team" />}
    />
  );
}
