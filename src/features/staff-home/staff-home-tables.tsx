"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/shared/data-table";
import { notInPrototype } from "@/components/shared/prototype";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { formatNumber, formatQty, formatShortDate } from "@/lib/formatters";

import type { RecentReceipt, WaitingOrder } from "./data/queries";
import { dueLabel } from "./staff-home-logic";

// Measured in 39_14_Staff_home.jpeg: 10 px cell padding, 56 px rows (two 16 px lines plus 11.5 px above and
// below) and a 46 px header whose 12 px labels sit 7 px below the centre. Column widths put each column where
// the reference has it; the action column takes the rest.
const CELL = "h-[46px] px-2.5 py-[11.5px] first:pl-2.5 last:pr-2.5";
const head = (label: string) => <span className="block pt-[7px]">{label}</span>;
const actionHead = () => <span className="sr-only">Action</span>;

function PoItem({ po, item }: { po: string; item: string }) {
  return (
    <>
      <span className="block text-[13.5px] leading-4 font-bold">{po}</span>
      <span className="block text-[12.5px] leading-4 font-bold text-table-head-foreground">{item}</span>
    </>
  );
}

const waitingColumns: ColumnDef<WaitingOrder>[] = [
  {
    accessorKey: "po",
    header: () => head("PO / Item"),
    meta: { className: `${CELL} w-[155px]` },
    cell: ({ row }) => <PoItem po={row.original.po} item={row.original.item} />,
  },
  { accessorKey: "supplier", header: () => head("Supplier"), meta: { className: `${CELL} w-[156px]` } },
  {
    accessorKey: "ordered",
    header: () => head("Ordered"),
    meta: { align: "right", className: `${CELL} w-[115px]` },
    cell: ({ row }) => formatQty(row.original.ordered, row.original.unit),
  },
  {
    accessorKey: "due",
    header: () => head("Due"),
    meta: { className: `${CELL} w-[128px]` },
    // Measured 9 px side padding (the shared pill has 10).
    cell: ({ row }) => (
      <StatusPill tone={row.original.dueTone} className="px-[9px]">
        {dueLabel(row.original)}
      </StatusPill>
    ),
  },
  {
    id: "action",
    header: actionHead,
    meta: { align: "right", className: CELL },
    cell: ({ row }) => {
      const { po } = row.original;
      return (
        <Button
          type="button"
          aria-label={`Record receipt for ${po}`}
          className="h-[29px] px-3 text-[13px]"
          onClick={() => notInPrototype(`Record receipt for ${po}`)}
        >
          Record receipt
        </Button>
      );
    },
  },
];

const recentColumns: ColumnDef<RecentReceipt>[] = [
  {
    accessorKey: "po",
    header: () => head("PO / Item"),
    meta: { className: `${CELL} w-[193.5px]` },
    cell: ({ row }) => <PoItem po={row.original.po} item={row.original.item} />,
  },
  {
    accessorKey: "received",
    header: () => head("Received"),
    meta: { align: "right", className: `${CELL} w-[120px]` },
    cell: ({ row }) => formatQty(row.original.received, row.original.unit),
  },
  {
    accessorKey: "bundles",
    header: () => head("Bundles"),
    meta: { align: "right", className: `${CELL} w-[122px]` },
    cell: ({ row }) => formatNumber(row.original.bundles),
  },
  {
    accessorKey: "savedOn",
    header: () => head("Saved on"),
    meta: { className: `${CELL} w-[120px]` },
    cell: ({ row }) => formatShortDate(row.original.savedOn),
  },
  {
    id: "action",
    header: actionHead,
    meta: { align: "right", className: CELL },
    cell: ({ row }) => (
      <Button
        type="button"
        variant="outline"
        aria-label={`Edit receipt ${row.original.po} ${row.original.item}`}
        className="h-[31px] px-[13px] text-[13px]"
        onClick={() => notInPrototype("Edit receipt")}
      >
        Edit
      </Button>
    ),
  },
];

export function WaitingTable({ rows }: { rows: WaitingOrder[] }) {
  return <DataTable columns={waitingColumns} data={rows} getRowId={(r) => r.po} density="dense" variant="plain" />;
}

export function RecentReceiptsTable({ rows }: { rows: RecentReceipt[] }) {
  return <DataTable columns={recentColumns} data={rows} getRowId={(r) => r.id} density="dense" variant="plain" />;
}
