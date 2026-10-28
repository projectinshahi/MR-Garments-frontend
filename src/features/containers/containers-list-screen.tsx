"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { KpiCard, KpiRow } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { FilterChips, FilterSelect, SearchInput } from "@/components/shared/filters";
import { PoLink } from "@/components/shared/po-link";
import { StatusPill, TermsBadge } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/formatters";

import { ALL, CONTAINER_STATUS, containerChips, filterContainers, type ContainerChip, type ContainerFilters } from "./containers-logic";
import type { ContainerRow, ContainersListData } from "./data/queries";

const TERMS_OPTIONS = [
  { value: ALL, label: "All terms" },
  { value: "FOB", label: "FOB" },
  { value: "CNF", label: "CNF" },
];

const date = (value: string | null) => (value ? formatShortDate(value) : "–");

const linkClass = "rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";
// Links inside a clickable row: the row's own click must not also navigate.
const stop = (event: React.MouseEvent) => event.stopPropagation();

// Column widths measured from 24_8.1_Containers_list.jpeg (cell starts at the 1440 px reference).
const columnsFor = (linkPos: boolean): ColumnDef<ContainerRow>[] => [
  {
    accessorKey: "number",
    header: "Container",
    meta: { className: "w-[142px] font-bold" },
    cell: ({ row }) => (
      <Link href={`/containers/${row.original.id}`} onClick={stop} className={linkClass}>
        {row.original.number}
      </Link>
    ),
  },
  { accessorKey: "agent", header: "Shipping agent", meta: { className: "w-[132px]" } },
  { accessorKey: "terms", header: "Terms", meta: { className: "w-[93px]" }, cell: ({ row }) => <TermsBadge terms={row.original.terms} /> },
  {
    id: "orders",
    header: "Orders inside",
    meta: { className: "w-[206px]" },
    cell: ({ row }) => (
      <span onClick={stop}>
        {row.original.orders.map((o, i) => (
          <Fragment key={o.po}>
            {i > 0 ? ", " : null}
            <PoLink po={o.po} linked={linkPos} className="font-normal" />
            {o.part ? " (part)" : null}
          </Fragment>
        ))}
      </span>
    ),
  },
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
    cell: ({ row }) => <StatusPill tone={CONTAINER_STATUS[row.original.status].tone}>{CONTAINER_STATUS[row.original.status].label}</StatusPill>,
  },
];

/**
 * Containers list (24_8.1_Containers_list.jpeg), from CON-1. Search, selects and chips narrow the rows on the client.
 * A row (or its container number, for the keyboard) opens the container's detail page.
 */
export function ContainersListScreen({ data }: { data: ContainersListData }) {
  const { kpis, canEnter, linkPos } = data;
  const router = useRouter();
  const columns = useMemo(() => columnsFor(linkPos), [linkPos]);
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
            {canEnter ? (
              <Button asChild size="header">
                <Link href="/containers/new">+ New container</Link>
              </Button>
            ) : null}
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
          getRowId={(r) => r.id}
          onRowClick={(r) => router.push(`/containers/${r.id}`)}
          size="sm"
          header="tall"
          density="relaxed"
          emptyState={data.containers.length ? "No containers match these filters." : "No containers yet."}
        />
        <p className="text-[13px] leading-4 text-muted-foreground">{data.footnote}</p>
      </PageContainer>
    </>
  );
}
