"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/shared/data-table";
import { formatDateTime } from "@/lib/formatters";

import type { HistoryEvent } from "./data/queries";

// Widths put each column where 14_3.1.i_History.jpeg has it; "What happened" takes the rest. The 17/15 px lines of
// the two-line cell give the reference's 49 px rows.
const columns: ColumnDef<HistoryEvent>[] = [
  { accessorKey: "at", header: "When", meta: { className: "w-[199px]" }, cell: ({ row }) => formatDateTime(row.original.at) },
  { accessorKey: "who", header: "Who", meta: { className: "w-[156px] font-bold" } },
  { accessorKey: "team", header: "Team", meta: { className: "w-[147px]" } },
  {
    id: "what",
    header: "What happened",
    cell: ({ row }) => (
      <>
        <p className="leading-[17px] font-bold">{row.original.title}</p>
        <p className="text-[12.5px] leading-[15px] text-muted-foreground">{row.original.detail}</p>
      </>
    ),
  },
];

/** The order's history log: when, who, which team, and what happened. */
export function HistoryTable({ events }: { events: HistoryEvent[] }) {
  return <DataTable columns={columns} data={events} density="snug" size="sm" />;
}
