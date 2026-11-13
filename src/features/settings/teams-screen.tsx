"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import type { TeamRow } from "@/lib/api/types";
import { formatINR, formatNumber } from "@/lib/formatters";

import { addHref } from "./settings-dialog";
import { actionClass, bold, right, SettingsList, type SettingsReport, textColumns } from "./settings-list";
import { averagePerPieceText } from "./settings-logic";
import { TeamDialog, teamDeletable, TEAMS_PATH } from "./teams-dialog";

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

const report: SettingsReport<TeamRow> = {
  title: "Teams",
  slug: "teams",
  columns: [
    ...textColumns("Team", "Pieces in stock"),
    { header: "Landed cost of stock (INR)", currency: "INR" },
    { header: "Average per piece (INR)", currency: "INR" },
    ...textColumns("Status"),
  ],
  row: (r) => [r.name, r.piecesInStock, r.landedCostOfStockInr, r.averagePerPieceInr, r.status],
};

/** 45_15.6_Teams.jpeg, plus the add and edit dialogs (?dialog=add, ?dialog=edit&id=). */
export function TeamsScreen({ rows }: { rows: TeamRow[] }) {
  return (
    <>
      <SettingsList
        path={TEAMS_PATH}
        rows={rows}
        columns={teamColumns}
        searchText={(row) => [row.name]}
        noun="teams"
        report={report}
        deletable={teamDeletable}
        footnote="Goods are split between these teams when they are received in the warehouse. Team names here are examples."
        action={
          <Button asChild size="header" className={actionClass}>
            <Link href={addHref(TEAMS_PATH)} replace scroll={false}>
              + Add team
            </Link>
          </Button>
        }
      />
      <Suspense fallback={null}>
        <TeamDialog rows={rows} />
      </Suspense>
    </>
  );
}
