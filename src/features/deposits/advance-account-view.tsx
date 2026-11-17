"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { KpiCard, KpiRow } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { PoLink } from "@/components/shared/po-link";
import { EmptyState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import type { AdvanceAccount } from "@/lib/api/deposits-types";
import { formatDate, formatINR, formatRateInr } from "@/lib/formatters";

import { ADVANCE_KIND_LABEL, ADVANCE_KIND_TONE, signedAdvance, summaryTotals } from "./advance-logic";
import { amountList, amountText } from "./deposits-logic";

// A supplier's advance account (backend docs/supplier-advance.md) as the statement and the supplier report show it:
// the totals per currency, then every entry newest first with the available advance right after it. Read only.

type Entry = AdvanceAccount["entries"][number];
const DASH = "–";

const columns = (linkPos: boolean): ColumnDef<Entry>[] => [
  { accessorKey: "entryDate", header: "Date", cell: ({ row }) => formatDate(row.original.entryDate) },
  { accessorKey: "kind", header: "Type", cell: ({ row }) => <StatusPill tone={ADVANCE_KIND_TONE[row.original.kind]}>{ADVANCE_KIND_LABEL[row.original.kind]}</StatusPill> },
  // A deleted order keeps its PO number as text (no order to open).
  { accessorKey: "po", header: "PO", cell: ({ row }) => (row.original.po ? <PoLink po={row.original.po} linked={linkPos && row.original.orderId !== null} /> : DASH) },
  {
    accessorKey: "amount",
    header: "Amount",
    meta: { align: "right" },
    cell: ({ row }) => {
      const signed = signedAdvance(row.original);
      return `${signed < 0 ? "−" : "+"}${amountText(Math.abs(signed), row.original.currency)}`;
    },
  },
  { accessorKey: "exchangeRate", header: "Rate (INR)", meta: { align: "right" }, cell: ({ row }) => formatRateInr(row.original.exchangeRate) },
  { accessorKey: "amountInr", header: "INR", meta: { align: "right" }, cell: ({ row }) => formatINR(row.original.amountInr, 2) },
  { accessorKey: "balance", header: "Available after", meta: { align: "right" }, cell: ({ row }) => amountText(row.original.balance, row.original.currency) },
  { accessorKey: "mode", header: "Mode", cell: ({ row }) => row.original.mode || DASH },
  { accessorKey: "reference", header: "Reference", cell: ({ row }) => row.original.reference || DASH },
  {
    accessorKey: "notes",
    header: "Notes",
    meta: { className: "max-w-[200px] truncate" },
    cell: ({ row }) => (row.original.notes ? <span title={row.original.notes}>{row.original.notes}</span> : DASH),
  },
];

export function AdvanceAccountView({ account, supplierName, linkPos }: { account: AdvanceAccount; supplierName: string; linkPos: boolean }) {
  const { summary, entries } = account;
  const each = (pick: Parameters<typeof summaryTotals>[1]) => amountList(summaryTotals(summary, pick));
  return (
    <div className="flex flex-col gap-3">
      <KpiRow gap="sm" className="md:grid-flow-row lg:grid-flow-col">
        <KpiCard size="xs" label="Available advance" value={each((s) => s.availableCny)} sub="received less applied, plus returned" />
        <KpiCard size="xs" label="Advance received" value={each((s) => s.receivedCny)} sub="paid to the supplier before any order" />
        <KpiCard size="xs" label="Applied to orders" value={each((s) => s.allocatedCny)} sub={`${summary.reduce((n, s) => n + s.orders, 0)} order(s)`} />
        <KpiCard size="xs" label="Returned from orders" value={each((s) => s.reversedCny)} sub="orders edited down or deleted" />
      </KpiRow>
      {/* No entries: the empty state alone, as the report's other lists (no empty table). */}
      {entries.length === 0 ? (
        <EmptyState title={`No advance recorded with ${supplierName} yet.`} />
      ) : (
        <DataTable columns={columns(linkPos)} data={entries} getRowId={(row) => row.id} size="sm" header="tall" pagination={{ pageSize: 10, itemLabel: "entries" }} />
      )}
    </div>
  );
}
