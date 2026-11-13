"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { KpiCard, KpiRow } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { FilterChips, FilterSelect, SearchInput } from "@/components/shared/filters";
import { PoLink } from "@/components/shared/po-link";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { ACTIONS_COLUMN_CLASS, DeleteRecordButton, RecordFacts } from "@/features/order-detail/shared/delete-record";
import { describeFilters } from "@/features/reports/report-files";
import { ReportDownload } from "@/features/reports/report-actions";
import { formatDate, formatNumber, formatQty, formatShortDate } from "@/lib/formatters";
import { todayInIndia } from "@/lib/today";
import { cn } from "@/lib/utils";
import type { Tone } from "@/types/domain";

import type { ReceiptRow, ReceiptState, ReceivingListData } from "./data/queries";
import { receivingFile } from "./receiving-files";
import { ALL, filterReceipts, type ReceiptFilters } from "./receiving-logic";

const STATE_TONE: Record<ReceiptState, Tone> = { partly: "warning", complete: "success" };

/**
 * REC-4 from the list: the order page's Delete Goods Receipt dialog with the receipt's facts. Goods only it covers
 * already in a container (REC-1 `containers`): Delete explains which containers to delete first instead (Close only).
 * `onlyReceipt`: the order has no other receipt, so it goes back to waiting to be received.
 */
function DeleteReceipt({ row, onlyReceipt }: { row: ReceiptRow; onlyReceipt: boolean }) {
  const containers = row.containers ?? [];
  const many = containers.length > 1;
  const po = <strong className="whitespace-nowrap text-foreground">{row.po}</strong>;
  const facts = (
    <RecordFacts
      facts={[
        ["Reference", <span key="id" className="font-normal break-all">{row.id}</span>],
        ["Order", `${row.po} · ${row.supplier}`],
        ["Received", row.received],
        ["Received on", formatDate(row.receivedOn)],
        ["Office", row.office],
        ["Bundles", formatNumber(row.bundles)],
        ...(row.containers ? [["In containers", row.containers.join(", ") || "None"] satisfies [string, string]] : []),
      ]}
    />
  );
  return (
    <DeleteRecordButton
      path={`/receipts/${row.id}`}
      noun="receipt"
      label={`Delete receipt of ${row.po} on ${formatDate(row.receivedOn)}, ${row.received}`}
      title="Delete Goods Receipt?"
      refused={
        containers.length > 0 ? (
          <>
            <p>
              This receipt from {po} can&apos;t be deleted: {many ? `containers ${containers.join(", ")} already hold` : `container ${containers[0]} already holds`}{" "}
              goods from it.
            </p>
            {facts}
            <p className="font-bold text-foreground">
              Delete {many ? "those containers" : "that container"} first. A container with a clearing, transport trip or warehouse receipt needs
              those deleted before it.
            </p>
          </>
        ) : undefined
      }
      description={
        <>
          <p>Are you sure you want to delete this receipt from {po}? This can&apos;t be undone.</p>
          {facts}
          <p className="font-bold text-foreground">
            {row.po}&apos;s received quantity goes down by {row.received}.{" "}
            {onlyReceipt ? "It is the order's only receipt, so the order goes back to waiting to be received." : "Its other receipts stay."}
          </p>
          <p>Only this receipt goes: the order, its containers and payments don&apos;t change. Goods loaded from it meanwhile refuse the delete.</p>
        </>
      }
    />
  );
}

const CHIPS = [
  { value: ALL, label: "All" },
  { value: "partly", label: "Partly received" },
  { value: "complete", label: "Complete" },
];

/**
 * `linkPos`: the PO opens the order (canOpen /orders); otherwise plain text. `receiptsOf`: each order's receipt count,
 * given only to Management (receiving Full), who then gets Actions after Status with Delete on every receipt (REC-4).
 */
const columnsFor = (linkPos: boolean, receiptsOf: Map<string, number> | null): ColumnDef<ReceiptRow>[] => {
  // With Actions, twelve columns need about 30 px more than 1440 gives: cells pad 12 px instead of 14.5 (the outer
  // edges keep theirs), and a long supplier name wraps instead of pushing Delete out of view.
  const fit = (className?: string, wrap = false) => (receiptsOf ? cn(className, "px-3", wrap && "whitespace-normal") : className);
  return [
    { accessorKey: "receivedOn", header: "Received on", meta: { className: fit() }, cell: ({ row }) => formatShortDate(row.original.receivedOn) },
    { accessorKey: "po", header: "PO", meta: { className: fit("font-bold") }, cell: ({ row }) => <PoLink po={row.original.po} linked={linkPos} /> },
    { accessorKey: "supplier", header: "Supplier", meta: { className: fit(undefined, true) } },
    { accessorKey: "item", header: "Item", meta: { className: fit() } },
    { accessorKey: "ordered", header: "Ordered", meta: { className: fit() }, cell: ({ row }) => formatQty(row.original.ordered, row.original.unit) },
    { accessorKey: "thisReceipt", header: "This receipt", meta: { align: "right", className: fit() }, cell: ({ row }) => formatNumber(row.original.thisReceipt) },
    { accessorKey: "totalSoFar", header: "Total so far", meta: { align: "right", className: fit() }, cell: ({ row }) => formatNumber(row.original.totalSoFar) },
    {
      accessorKey: "short",
      header: "Short",
      meta: { align: "right", className: fit() },
      cell: ({ row }) => (row.original.short === null ? "–" : formatNumber(row.original.short)),
    },
    { accessorKey: "bundles", header: "Bundles", meta: { align: "right", className: fit() }, cell: ({ row }) => formatNumber(row.original.bundles) },
    { accessorKey: "receivedBy", header: "Received by", meta: { className: fit() } },
    {
      accessorKey: "statusLabel",
      header: "Status",
      meta: { className: fit() },
      cell: ({ row }) => <StatusPill tone={STATE_TONE[row.original.state]}>{row.original.statusLabel}</StatusPill>,
    },
    ...(receiptsOf
      ? [
          {
            id: "actions",
            header: "Actions",
            meta: { className: `w-[84px] ${ACTIONS_COLUMN_CLASS}` },
            cell: ({ row }) => <DeleteReceipt row={row.original} onlyReceipt={receiptsOf.get(row.original.orderId) === 1} />,
          } satisfies ColumnDef<ReceiptRow>,
        ]
      : []),
  ];
};

/** Receiving (China) list (22_7.1_Receiving_list.jpeg), live from REC-1. Search and filters narrow the rows on the client. */
export function ReceivingListScreen({ data }: { data: ReceivingListData }) {
  const { kpis } = data;
  const [filters, setFilters] = useState<ReceiptFilters>({ query: "", office: ALL, supplier: ALL, state: ALL });
  const set = (patch: Partial<ReceiptFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const rows = filterReceipts(data.receipts, filters);
  const columns = useMemo(() => {
    // Counted over every receipt, not the filtered rows: an order's other receipts stay even when hidden.
    const receiptsOf = new Map<string, number>();
    for (const r of data.receipts) receiptsOf.set(r.orderId, (receiptsOf.get(r.orderId) ?? 0) + 1);
    return columnsFor(data.linkPos, data.canDelete ? receiptsOf : null);
  }, [data.linkPos, data.canDelete, data.receipts]);

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
            <ReportDownload
              file={() =>
                receivingFile(
                  rows,
                  kpis,
                  describeFilters([
                    filters.query.trim() && `Search: "${filters.query.trim()}"`,
                    filters.office !== ALL && `Office: ${filters.office}`,
                    filters.supplier !== ALL && `Supplier: ${filters.supplier}`,
                    filters.state !== ALL && `Status: ${CHIPS.find((c) => c.value === filters.state)?.label}`,
                  ]),
                  todayInIndia(),
                )
              }
            />
            {data.canRecord ? (
              <Button asChild size="header">
                <Link href="/receiving/new">+ Record receipt</Link>
              </Button>
            ) : null}
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
