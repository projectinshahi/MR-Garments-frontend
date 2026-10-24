"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { KpiCard, KpiRow } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { FilterChips, FilterSelect, SearchInput } from "@/components/shared/filters";
import { StatusPill, TermsBadge } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/formatters";
import type { Tone } from "@/types/domain";

import { ALL, containerChips, filterContainers, type ContainerChip, type ContainerFilters } from "./containers-logic";
import type { ContainerRow, ContainerStatus, ContainersListData } from "./data/queries";

const STATUS: Record<ContainerStatus, { label: string; tone: Tone }> = {
  loading: { label: "Loading", tone: "warning" },
  sea: { label: "On the sea", tone: "info" },
  arrived: { label: "Arrived, in clearing", tone: "success" },
};

const TERMS_OPTIONS = [
  { value: ALL, label: "All terms" },
  { value: "FOB", label: "FOB" },
  { value: "CNF", label: "CNF" },
];

const date = (value: string | null) => (value ? formatShortDate(value) : "–");

// Column widths measured from 24_8.1_Containers_list.jpeg (cell starts at the 1440 px reference).
const columns: ColumnDef<ContainerRow>[] = [
  { accessorKey: "number", header: "Container", meta: { className: "w-[142px] font-bold" } },
  { accessorKey: "agent", header: "Shipping agent", meta: { className: "w-[132px]" } },
  { accessorKey: "terms", header: "Terms", meta: { className: "w-[93px]" }, cell: ({ row }) => <TermsBadge terms={row.original.terms} /> },
  { id: "orders", header: "Orders inside", meta: { className: "w-[206px]" }, cell: ({ row }) => row.original.orders.join(", ") },
  { accessorKey: "bundles", header: "Bundles", meta: { className: "w-[94px]" } },
  { id: "loadedOn", header: "Loaded on", meta: { align: "right", className: "w-[94px]" }, cell: ({ row }) => date(row.original.loadedOn) },
  { id: "sailedOn", header: "Sailed on", meta: { className: "w-[93px]" }, cell: ({ row }) => date(row.original.sailedOn) },
  {
    id: "etaIndia",
    header: "ETA India",
    meta: { className: "w-[108px]" },
    cell: ({ row }) => `${row.original.etaEstimated ? "Est. " : ""}${formatShortDate(row.original.etaIndia)}`,
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <StatusPill tone={STATUS[row.original.status].tone}>{STATUS[row.original.status].label}</StatusPill>,
  },
];

/** Containers list (24_8.1_Containers_list.jpeg). Search, selects and chips narrow the rows on the client. */
export function ContainersListScreen({ data }: { data: ContainersListData }) {
  const { kpis } = data;
  const [filters, setFilters] = useState<ContainerFilters>({ query: "", agent: ALL, terms: ALL, chip: "active" });
  const set = (patch: Partial<ContainerFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const rows = filterContainers(data.containers, filters);

  return (
    <>
      <PageHeader
        title="Containers"
        actions={
          <>
            <SearchInput
              size="sm"
              label="Search container or PO"
              placeholder="Search container or PO"
              value={filters.query}
              onValueChange={(query) => set({ query })}
              className="hidden w-[170px] sm:flex lg:w-[250px]"
            />
            <Button asChild size="header">
              <Link href="/containers/new">+ New container</Link>
            </Button>
          </>
        }
      />
      <PageContainer>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-3">
            <FilterSelect
              label="Shipping agent"
              size="sm"
              value={filters.agent}
              options={[{ value: ALL, label: "All agents" }, ...data.agents.map((a) => ({ value: a, label: a }))]}
              onValueChange={(agent) => set({ agent })}
            />
            <FilterSelect label="Terms" size="sm" value={filters.terms} options={TERMS_OPTIONS} onValueChange={(terms) => set({ terms })} />
          </div>
          <FilterChips
            label="Container status"
            size="sm"
            options={containerChips(data.containers)}
            value={filters.chip}
            onValueChange={(chip) => set({ chip: chip as ContainerChip })}
          />
        </div>

        <KpiRow gap="sm">
          <KpiCard size="xs" label="Active containers" value={kpis.active} sub="on the way or in port" />
          <KpiCard size="xs" label="Arriving this week" value={kpis.arrivingThisWeek.length} sub={kpis.arrivingThisWeek.join(" · ")} />
          <KpiCard size="xs" label="Loading now" value={kpis.loadingNow.length} sub={kpis.loadingNow.join(" · ")} />
          <KpiCard size="xs" label="Arrived, in clearing" value={kpis.arrivedInClearing.length} sub={kpis.arrivedInClearing.join(" · ")} />
        </KpiRow>

        <DataTable
          columns={columns}
          data={rows}
          getRowId={(r) => r.number}
          size="sm"
          density="tall"
          emptyState="No containers match these filters."
        />
        <p className="text-[13px] leading-4 text-muted-foreground">{data.footnote}</p>
      </PageContainer>
    </>
  );
}
