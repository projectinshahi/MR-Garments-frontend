"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { KpiCard, KpiRow } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { FilterChips, FilterSelect, SearchInput } from "@/components/shared/filters";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { formatNumber, formatQty, formatShortDate } from "@/lib/formatters";
import type { Tone } from "@/types/domain";

import type { ReceiptRow, ReceiptState, ReceivingListData } from "./data/queries";
import { ALL, filterReceipts, type ReceiptFilters } from "./receiving-logic";

const STATE_TONE: Record<ReceiptState, Tone> = { short: "danger", partly: "warning", complete: "success" };

const CHIPS = [
  { value: ALL, label: "All" },
  { value: "partly", label: "Partly received" },
  { value: "short", label: "Short" },
  { value: "complete", label: "Complete" },
];

const columns: ColumnDef<ReceiptRow>[] = [
  { accessorKey: "receivedOn", header: "Received on", cell: ({ row }) => formatShortDate(row.original.receivedOn) },
  { accessorKey: "po", header: "PO", meta: { className: "font-bold" } },
  { accessorKey: "supplier", header: "Supplier" },
  { accessorKey: "item", header: "Item" },
  { accessorKey: "ordered", header: "Ordered", cell: ({ row }) => formatQty(row.original.ordered, row.original.unit) },
  { accessorKey: "thisReceipt", header: "This receipt", meta: { align: "right" }, cell: ({ row }) => formatNumber(row.original.thisReceipt) },
  { accessorKey: "totalSoFar", header: "Total so far", meta: { align: "right" }, cell: ({ row }) => formatNumber(row.original.totalSoFar) },
  {
    accessorKey: "short",
    header: "Short",
    meta: { align: "right" },
    cell: ({ row }) => (row.original.short === null ? "–" : formatNumber(row.original.short)),
  },
  { accessorKey: "bundles", header: "Bundles", meta: { align: "right" }, cell: ({ row }) => formatNumber(row.original.bundles) },
  { accessorKey: "receivedBy", header: "Received by" },
  {
    accessorKey: "statusLabel",
    header: "Status",
    cell: ({ row }) => <StatusPill tone={STATE_TONE[row.original.state]}>{row.original.statusLabel}</StatusPill>,
  },
];

/** Receiving (China) list (22_7.1_Receiving_list.jpeg), live from REC-1. Search and filters narrow the rows on the client. */
export function ReceivingListScreen({ data }: { data: ReceivingListData }) {
  const { kpis } = data;
  const [filters, setFilters] = useState<ReceiptFilters>({ query: "", office: ALL, supplier: ALL, state: ALL });
  const set = (patch: Partial<ReceiptFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const rows = filterReceipts(data.receipts, filters);

  return (
    <>
      <PageHeader
        title="Receiving (China)"
        actions={
          <>
            <SearchInput
              size="sm"
              label="Search PO or supplier"
              placeholder="Search PO or supplier"
              value={filters.query}
              onValueChange={(query) => set({ query })}
              className="hidden w-[170px] sm:flex lg:w-[250px]"
            />
            <Button asChild size="header">
              <Link href="/receiving/new">+ Record receipt</Link>
            </Button>
          </>
        }
      />
      <PageContainer>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-3">
            <FilterSelect
              label="Office"
              size="sm"
              value={filters.office}
              options={[{ value: ALL, label: "All offices" }, ...data.offices.map((o) => ({ value: o, label: o }))]}
              onValueChange={(office) => set({ office })}
            />
            <FilterSelect
              label="Supplier"
              size="sm"
              value={filters.supplier}
              options={[{ value: ALL, label: "All suppliers" }, ...data.suppliers.map((s) => ({ value: s, label: s }))]}
              onValueChange={(supplier) => set({ supplier })}
            />
          </div>
          <FilterChips
            label="Receipt status"
            size="sm"
            options={CHIPS}
            value={filters.state}
            onValueChange={(state) => set({ state: state as ReceiptFilters["state"] })}
          />
        </div>

        <KpiRow gap="sm">
          <KpiCard size="xs" label={`Receipts in ${kpis.month}`} value={kpis.receiptsThisMonth} sub={`from ${kpis.receiptsSupplierCount} suppliers`} />
          <KpiCard size="xs" label="Waiting to be received" value={kpis.waitingToBeReceived ?? "–"} sub="orders not yet in China office" />
          <KpiCard size="xs" label="Partly received" value={kpis.partlyReceived} sub={kpis.partlyReceivedPos.join(" · ")} />
          {/* REC-1 has no counted-short fact, so short items are unknown ("–") until the contract adds one. */}
          <KpiCard size="xs" label="Short items this month" value="–" />
        </KpiRow>

        <DataTable columns={columns} data={rows} getRowId={(r) => r.id} size="sm" header="tall" emptyState={data.receipts.length ? "No receipts match these filters." : "No receipts yet."} />
      </PageContainer>
    </>
  );
}
