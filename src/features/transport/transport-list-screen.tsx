"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useState } from "react";

import { useNavigate } from "@/components/layout/navigation-progress";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { CardNote, KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { FilterChips, FilterSelect, SearchInput } from "@/components/shared/filters";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { formatExactINR } from "@/features/clearing/stage-form";
import type { TransportList, TripListRow } from "@/lib/api/stages-types";
import { formatNumber, formatShortDate } from "@/lib/formatters";

import type { TransportListData } from "./data/queries";
import { ALL, filterTransports, kpiSubs, transportTotals, type TransportFilters } from "./transport-logic";

const CHIPS = [
  { value: ALL, label: "All" },
  { value: "on-the-way", label: "On the way" },
  { value: "delivered", label: "Delivered" },
];

// Only the last 30 days are designed; the KPIs count them, the table lists every trip.
const PERIODS = [{ value: "last-30-days", label: "Last 30 days" }];

const focusRing = "rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const formHref = (containerId: string) => `/transport/${containerId}`;

function VehicleCell({ row }: { row: TripListRow }) {
  return (
    // The row would navigate too, so the link keeps its own click.
    <Link href={formHref(row.containerId)} onClick={(event) => event.stopPropagation()} className={`flex flex-col justify-center ${focusRing} hover:underline`}>
      <span className="block text-sm leading-[18px] font-bold">{row.vehicleNumber}</span>
      <span className="block text-[12.5px] leading-[14px] text-muted-foreground">{row.lrNumber}</span>
    </Link>
  );
}

const rowsOf = (rows: { original: TripListRow }[]) => rows.map((r) => r.original);

const kpiSub = (text: string) => <span className="text-[12.5px]">{text}</span>;

// Column widths from the reference; together they fill the 1134 px table. With DataTable's 14.5 px cell padding the
// columns' content needs 1138 px (the table scrolled sideways), so cells pad 14 px; the outer edges keep 14.5 px.
const columns: ColumnDef<TripListRow>[] = [
  {
    id: "vehicle",
    header: "Vehicle / LR number",
    meta: { className: "w-[147.5px] px-[14px]" },
    cell: ({ row }) => <VehicleCell row={row.original} />,
    footer: ({ table }) => transportTotals(rowsOf(table.getRowModel().rows)).label,
  },
  { id: "company", header: "Transport company", meta: { className: "w-[145px] px-[14px]" }, cell: ({ row }) => row.original.company.name },
  { accessorKey: "container", header: "Container", meta: { className: "w-[128px] px-[14px]" } },
  { id: "orders", header: "Orders", meta: { className: "w-[149px] px-[14px]" }, cell: ({ row }) => row.original.orders.join(", ") },
  {
    accessorKey: "bundlesLoaded",
    header: "Bundles loaded",
    meta: { align: "right", className: "w-[121.5px] px-[14px]" },
    cell: ({ row }) => formatNumber(row.original.bundlesLoaded),
  },
  {
    accessorKey: "loadedOn",
    header: "Loaded on",
    meta: { className: "w-[91.5px] px-[14px]" },
    cell: ({ row }) => formatShortDate(row.original.loadedOn),
  },
  {
    id: "unloadedOn",
    header: "Unloaded on",
    meta: { className: "w-[104.5px] px-[14px]" },
    cell: ({ row }) => (row.original.unloadedOn ? formatShortDate(row.original.unloadedOn) : "–"),
  },
  {
    id: "received",
    header: "Bundles received",
    meta: { className: "w-[132px] px-[14px]" },
    cell: ({ row }) => {
      const { bundlesReceived, bundlesLoaded, status } = row.original;
      if (status === "on_road") return <StatusPill tone="info">On the way</StatusPill>;
      return (
        <StatusPill tone={bundlesReceived === bundlesLoaded ? "success" : "danger"}>
          {formatNumber(bundlesReceived ?? 0)} of {formatNumber(bundlesLoaded)}
        </StatusPill>
      );
    },
  },
  {
    accessorKey: "costInr",
    header: "Transport cost",
    meta: { className: "w-[115px] px-[14px] font-bold" },
    cell: ({ row }) => formatExactINR(row.original.costInr),
    footer: ({ table }) => formatExactINR(transportTotals(rowsOf(table.getRowModel().rows)).cost),
  },
];

type Ready = TransportList["ready"][number];
const readyColumns: ColumnDef<Ready>[] = [
  {
    accessorKey: "container",
    header: "Container",
    meta: { className: "w-[165px]" },
    cell: ({ row }) => (
      <Link href={formHref(row.original.containerId)} onClick={(event) => event.stopPropagation()} className={`font-bold ${focusRing} hover:underline`}>
        {row.original.container}
      </Link>
    ),
  },
  { id: "orders", header: "Orders", cell: ({ row }) => row.original.orders.join(", ") },
  { accessorKey: "bundles", header: "Bundles", meta: { align: "right", className: "w-[100px]" }, cell: ({ row }) => formatNumber(row.original.bundles) },
  { id: "clearedOn", header: "Cleared on", meta: { className: "w-[120px]" }, cell: ({ row }) => formatShortDate(row.original.clearedOn) },
  { accessorKey: "clearingAgent", header: "Clearing agent", meta: { className: "w-[200px]" } },
];

/**
 * Transport list (28_10.1_Transport_list.jpeg), from TRN-1. Search, company and status chips narrow the vehicles on
 * the client. Below the designed table, the cleared containers still waiting for a vehicle.
 */
export function TransportListScreen({ data }: { data: TransportListData }) {
  const { kpis, ready, canEnter } = data;
  const navigate = useNavigate();
  const [filters, setFilters] = useState<TransportFilters>({ query: "", company: ALL, state: ALL });
  const [period, setPeriod] = useState(PERIODS[0].value);
  const set = (patch: Partial<TransportFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const rows = filterTransports(data.rows, filters);
  const subs = kpiSubs(kpis);

  return (
    <>
      <PageHeader
        title="Transport"
        actions={
          <>
            <SearchInput
              size="sm"
              label="Search vehicle, LR or PO"
              placeholder="Search vehicle, LR or PO"
              value={filters.query}
              onValueChange={(query) => set({ query })}
              className="hidden w-[170px] sm:flex lg:w-[250px]"
            />
            {canEnter ? (
              ready[0] ? (
                <Button asChild size="header" className="px-[15px]">
                  <Link href={formHref(ready[0].containerId)}>+ Record transport</Link>
                </Button>
              ) : (
                <Button size="header" className="px-[15px]" disabled title="No cleared container is waiting for a vehicle">
                  + Record transport
                </Button>
              )
            ) : null}
          </>
        }
      />
      <PageContainer>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <FilterSelect
              label="Transport company"
              size="sm"
              value={filters.company}
              options={[{ value: ALL, label: "All transport companies" }, ...data.companies.map((c) => ({ value: c.id, label: c.name }))]}
              onValueChange={(company) => set({ company })}
            />
            <FilterSelect label="Period" size="sm" value={period} options={PERIODS} onValueChange={setPeriod} />
          </div>
          <FilterChips
            label="Transport status"
            size="sm"
            options={CHIPS}
            value={filters.state}
            onValueChange={(state) => set({ state: state as TransportFilters["state"] })}
          />
        </div>

        {/* The reference indents the KPI text 18 px and sets the sub-lines at 12.5 px (KpiCard: 20 px, 13 px). */}
        <KpiRow gap="sm">
          <KpiCard size="xs" label="On the way now" value={formatNumber(kpis.onTheWay)} sub={kpiSub(subs.onTheWay)} />
          <KpiCard size="xs" label="Delivered, last 30 days" value={formatNumber(kpis.deliveredLast30Days)} sub={kpiSub("vehicles")} />
          <KpiCard size="xs" label="Bundles delivered" value={formatNumber(kpis.bundlesDeliveredLast30Days)} sub={kpiSub(subs.bundles)} />
          <KpiCard size="xs" label="Transport cost, last 30 days" value={formatExactINR(kpis.transportCostLast30DaysInr)} sub={kpiSub("freight, loading, unloading")} />
        </KpiRow>

        <DataTable
          columns={columns}
          data={rows}
          getRowId={(r) => r.id}
          size="sm"
          header="tall"
          density="loose"
          onRowClick={(row) => navigate(formHref(row.containerId))}
          emptyState={data.rows.length ? "No vehicles match these filters." : "No vehicles yet."}
        />

        {ready.length ? (
          <SectionCard title="Ready for transport" aside={<CardNote size="sm">Cleared, waiting for a vehicle</CardNote>} titleGap="none" bottomGap="tight">
            <DataTable
              columns={readyColumns}
              data={ready}
              getRowId={(r) => r.containerId}
              variant="plain"
              density="snug"
              className="mt-3"
              onRowClick={(r) => navigate(formHref(r.containerId))}
            />
          </SectionCard>
        ) : null}
      </PageContainer>
    </>
  );
}
