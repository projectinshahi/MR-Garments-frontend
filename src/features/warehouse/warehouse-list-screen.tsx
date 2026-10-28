"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { CardNote, KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { FilterSelect, SearchInput } from "@/components/shared/filters";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import type { WarehouseList, WarehouseListRow } from "@/lib/api/stages-types";
import { formatDate, formatINR, formatNumber, formatQty, formatShortDate } from "@/lib/formatters";

import type { WarehouseListData } from "./data/queries";
import { ALL, filterReceipts, summarizeReceipts, teamLabel, type ReceiptFilters } from "./warehouse-logic";

type Totals = ReturnType<typeof summarizeReceipts>;
type Team = WarehouseList["teams"][number];

const LAST_30_DAYS = "30d";
// Measured from the reference for its three teams; more teams share the remaining width.
const TEAM_WIDTHS = ["w-[73.5px]", "w-[105.5px]", "w-[78.5px]"];

const focusRing = "rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const receiveHref = (transportId: string) => `/warehouse/receive/${transportId}`;

/** Column widths measured from the reference; the totals row follows the rows shown. */
const columnsFor = (teams: Team[], totals: Totals, showCosts: boolean): ColumnDef<WarehouseListRow>[] => [
  { accessorKey: "receivedOn", header: "Received on", cell: ({ row }) => formatDate(row.original.receivedOn), footer: "Total", meta: { className: "w-[126px]" } },
  {
    accessorKey: "item",
    header: "Item",
    cell: ({ row }) => (
      <div className="flex flex-col justify-center">
        <span className="leading-[18px] font-bold">{row.original.item}</span>
        <span className="text-[12.5px] leading-4 text-muted-foreground">
          {row.original.po} · {row.original.supplier}
        </span>
      </div>
    ),
    footer: () => `${totals.items} ${totals.items === 1 ? "item" : "items"}`,
    meta: { className: "w-[252px]" },
  },
  { accessorKey: "container", header: "Container", meta: { className: "w-[150px]" } },
  {
    accessorKey: "received",
    header: "Received",
    cell: ({ row }) => formatNumber(row.original.received),
    footer: () => formatNumber(totals.received),
    meta: { align: "right", className: "w-[96.5px]" },
  },
  ...teams.map(
    (team, i): ColumnDef<WarehouseListRow> => ({
      id: `team-${team.id}`,
      header: teamLabel(team.name),
      cell: ({ row }) => formatNumber(row.original.teams[team.id] ?? 0),
      footer: () => formatNumber(totals.teams[team.id] ?? 0),
      meta: { align: "right", className: TEAM_WIDTHS[i] },
    }),
  ),
  { accessorKey: "receivedBy", header: "Received by", meta: { className: "w-[130px]" } },
  ...(showCosts
    ? [
        {
          id: "costPerPiece",
          header: "Cost per piece",
          cell: ({ row }) => (row.original.costPerPieceInr === null ? "–" : formatINR(row.original.costPerPieceInr, 2)),
          footer: () => (totals.costPerPiece === null ? "–" : formatINR(totals.costPerPiece, 2)),
          meta: { align: "right", className: "w-[122px]" },
        } satisfies ColumnDef<WarehouseListRow>,
      ]
    : []),
];

type Ready = WarehouseList["ready"][number];
const readyColumns: ColumnDef<Ready>[] = [
  {
    id: "vehicle",
    header: "Vehicle / LR number",
    meta: { className: "w-[170px]" },
    cell: ({ row }) => (
      // The row would navigate too, so the link keeps its own click.
      <Link href={receiveHref(row.original.transportId)} onClick={(event) => event.stopPropagation()} className={`flex flex-col ${focusRing} hover:underline`}>
        <span className="text-sm leading-[18px] font-bold">{row.original.vehicleNumber}</span>
        <span className="text-[12.5px] leading-[14px] text-muted-foreground">{row.original.lrNumber}</span>
      </Link>
    ),
  },
  { accessorKey: "container", header: "Container", meta: { className: "w-[150px]" } },
  { id: "orders", header: "Orders", cell: ({ row }) => row.original.orders.join(", ") },
  { id: "unloadedOn", header: "Unloaded on", meta: { className: "w-[120px]" }, cell: ({ row }) => formatShortDate(row.original.unloadedOn) },
  { accessorKey: "bundlesReceived", header: "Bundles", meta: { align: "right", className: "w-[90px]" }, cell: ({ row }) => formatNumber(row.original.bundlesReceived) },
  {
    id: "status",
    header: "Status",
    meta: { className: "w-[140px]" },
    cell: ({ row }) => (row.original.receiptStatus === "draft" ? <StatusPill tone="info">Draft saved</StatusPill> : <StatusPill tone="warning">Not started</StatusPill>),
  },
];

/**
 * Warehouse list (30_11.1_Warehouse_list.jpeg), from WH-1: one row per order per receipt in stock, a column per active
 * team. Warehouse, team and search narrow the rows and the totals on the client; the KPIs follow the warehouse.
 * Below the designed table, the unloaded trips still waiting to be received.
 */
export function WarehouseListScreen({ data }: { data: WarehouseListData }) {
  const { teams, ready, showCosts, canEnter } = data;
  const router = useRouter();
  const [filters, setFilters] = useState<ReceiptFilters>({ query: "", warehouse: data.warehouses[0]?.id ?? ALL, team: ALL });
  const set = (patch: Partial<ReceiptFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const rows = filterReceipts(data.rows, filters);
  const stock = summarizeReceipts(filterReceipts(data.rows, { query: "", warehouse: filters.warehouse, team: ALL }));
  const totals = summarizeReceipts(rows);

  return (
    <>
      <PageHeader
        title="Warehouse"
        actions={
          <>
            <SearchInput
              size="sm"
              label="Search item or PO"
              placeholder="Search item or PO"
              value={filters.query}
              onValueChange={(query) => set({ query })}
              className="hidden w-[170px] sm:flex lg:w-[250px]"
            />
            {canEnter ? (
              ready[0] ? (
                <Button asChild size="header" className="px-4">
                  <Link href={receiveHref(ready[0].transportId)}>+ Receive goods</Link>
                </Button>
              ) : (
                <Button size="header" className="px-4" disabled title="No unloaded trip is waiting to be received">
                  + Receive goods
                </Button>
              )
            ) : null}
          </>
        }
      />
      <PageContainer>
        <div className="flex flex-wrap gap-3">
          <FilterSelect
            label="Warehouse"
            size="sm"
            value={filters.warehouse}
            options={data.warehouses.length ? data.warehouses.map((w) => ({ value: w.id, label: w.name })) : [{ value: ALL, label: "All warehouses" }]}
            onValueChange={(warehouse) => set({ warehouse })}
          />
          <FilterSelect
            label="Team"
            size="sm"
            value={filters.team}
            options={[{ value: ALL, label: "All teams" }, ...teams.map((t) => ({ value: t.id, label: t.name }))]}
            onValueChange={(team) => set({ team })}
          />
          <FilterSelect
            label="Period"
            size="sm"
            value={LAST_30_DAYS}
            options={[{ value: LAST_30_DAYS, label: "Last 30 days" }]}
            onValueChange={() => undefined}
          />
        </div>

        <KpiRow gap="sm">
          <KpiCard size="xs" label="Received in stock" value={formatQty(stock.received, "pcs")} sub={`${stock.items} ${stock.items === 1 ? "item" : "items"}`} />
          {teams.map((team) => (
            <KpiCard key={team.id} size="xs" label={team.name} value={formatQty(stock.teams[team.id] ?? 0, "pcs")} />
          ))}
        </KpiRow>

        <DataTable
          columns={columnsFor(teams, totals, showCosts)}
          data={rows}
          getRowId={(r) => r.id}
          size="sm"
          header="tall"
          density="loose"
          emptyState={data.rows.length ? "No items match these filters." : "Nothing has been received into stock yet."}
        />
        <p className="mt-[2px] text-[12.5px] leading-5 text-muted-foreground">
          Cost per piece is shown to management only. Warehouse staff see quantities.
        </p>

        {ready.length ? (
          <SectionCard title="Waiting to be received" aside={<CardNote size="sm">Unloaded, not yet in stock</CardNote>} titleGap="none" bottomGap="tight">
            <DataTable
              columns={readyColumns}
              data={ready}
              getRowId={(r) => r.transportId}
              variant="plain"
              density="loose"
              className="mt-3"
              onRowClick={(r) => router.push(receiveHref(r.transportId))}
            />
          </SectionCard>
        ) : null}
      </PageContainer>
    </>
  );
}
