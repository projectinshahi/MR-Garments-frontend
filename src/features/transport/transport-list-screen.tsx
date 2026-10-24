"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { KpiCard, KpiRow } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { FilterChips, FilterSelect, SearchInput } from "@/components/shared/filters";
import { notInPrototype } from "@/components/shared/prototype";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { formatINR, formatNumber, formatShortDate } from "@/lib/formatters";

import type { TransportListData, TransportListRow } from "./data/queries";
import { ALL, filterTransports, transportKpis, transportTotals, type TransportFilters } from "./transport-logic";

const CHIPS = [
  { value: ALL, label: "All" },
  { value: "on-the-way", label: "On the way" },
  { value: "delivered", label: "Delivered" },
];

const PERIODS = [{ value: "last-30-days", label: "Last 30 days" }];

const focusRing = "rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function VehicleCell({ row }: { row: TransportListRow }) {
  const lines = (
    <>
      <span className="block text-sm leading-[18px] font-bold">{row.vehicle}</span>
      <span className="block text-[12.5px] leading-[14px] text-muted-foreground">{row.lr}</span>
    </>
  );
  const block = "flex flex-col justify-center";
  return row.formHref ? (
    // The row would navigate too, so the link keeps its own click.
    <Link href={row.formHref} onClick={(event) => event.stopPropagation()} className={`${block} ${focusRing} hover:underline`}>
      {lines}
    </Link>
  ) : (
    // No handler: the click bubbles to the row (notInPrototype). The button makes the row keyboard-reachable.
    <button type="button" className={`${block} ${focusRing}`}>
      {lines}
    </button>
  );
}

const rowsOf = (rows: { original: TransportListRow }[]) => rows.map((r) => r.original);

const kpiSub = (text: string) => <span className="text-[12.5px]">{text}</span>;

// Column widths from the reference; together they fill the 1134 px table. With DataTable's 14.5 px cell padding the
// columns' content needs 1138 px (the table scrolled sideways), so cells pad 14 px; the outer edges keep 14.5 px.
const columns: ColumnDef<TransportListRow>[] = [
  {
    id: "vehicle",
    header: "Vehicle / LR number",
    meta: { className: "w-[147.5px] px-[14px]" },
    cell: ({ row }) => <VehicleCell row={row.original} />,
    footer: ({ table }) => transportTotals(rowsOf(table.getRowModel().rows)).label,
  },
  { accessorKey: "company", header: "Transport company", meta: { className: "w-[145px] px-[14px]" } },
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
    accessorKey: "unloadedOn",
    header: "Unloaded on",
    meta: { className: "w-[104.5px] px-[14px]" },
    cell: ({ row }) => formatShortDate(row.original.unloadedOn),
  },
  {
    id: "received",
    header: "Bundles received",
    meta: { className: "w-[132px] px-[14px]" },
    cell: ({ row }) => {
      const { bundlesReceived, bundlesLoaded } = row.original;
      return (
        <StatusPill tone={bundlesReceived === bundlesLoaded ? "success" : "danger"}>
          {formatNumber(bundlesReceived)} of {formatNumber(bundlesLoaded)}
        </StatusPill>
      );
    },
  },
  {
    accessorKey: "cost",
    header: "Transport cost",
    meta: { className: "w-[115px] px-[14px] font-bold" },
    cell: ({ row }) => formatINR(row.original.cost),
    footer: ({ table }) => formatINR(transportTotals(rowsOf(table.getRowModel().rows)).cost),
  },
];

/** Transport list (28_10.1_Transport_list.jpeg). Search, company and status chips narrow the vehicles on the client. */
export function TransportListScreen({ data }: { data: TransportListData }) {
  const router = useRouter();
  const [filters, setFilters] = useState<TransportFilters>({ query: "", company: ALL, state: ALL });
  const [period, setPeriod] = useState(PERIODS[0].value);
  const set = (patch: Partial<TransportFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const rows = filterTransports(data.rows, filters);
  const kpis = transportKpis(data.rows);

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
            <Button asChild size="header" className="px-[15px]">
              <Link href={data.recordHref}>+ Record transport</Link>
            </Button>
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
              options={[{ value: ALL, label: "All transport companies" }, ...data.companies.map((c) => ({ value: c, label: c }))]}
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
          <KpiCard size="xs" label="On the way now" value={formatNumber(kpis.onTheWay)} sub={kpiSub("no vehicle on the road")} />
          <KpiCard size="xs" label="Delivered, last 30 days" value={formatNumber(kpis.delivered)} sub={kpiSub("vehicles")} />
          <KpiCard size="xs" label="Bundles delivered" value={formatNumber(kpis.bundlesDelivered)} sub={kpiSub("all counts matched")} />
          <KpiCard size="xs" label="Transport cost, last 30 days" value={formatINR(kpis.cost)} sub={kpiSub("freight, loading, unloading")} />
        </KpiRow>

        <DataTable
          columns={columns}
          data={rows}
          getRowId={(r) => r.id}
          size="sm"
          header="tall"
          density="loose"
          onRowClick={(row) => (row.formHref ? router.push(row.formHref) : notInPrototype(`Transport for ${row.vehicle}`))}
          emptyState="No vehicles match these filters."
        />
      </PageContainer>
    </>
  );
}
