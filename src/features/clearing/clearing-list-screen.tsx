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
import type { Tone } from "@/types/domain";

import { ALL, filterClearings, type ClearingFilters } from "./clearing-logic";
import { containerSlug, type ClearingListData, type ClearingRow, type ClearingState } from "./data/queries";

const STATE_TONE: Record<ClearingState, Tone> = { waiting: "warning", duty: "info", cleared: "success" };

const CHIPS = [
  { value: ALL, label: "All" },
  { value: "waiting", label: "Waiting for agent" },
  { value: "duty", label: "Duty to pay" },
  { value: "cleared", label: "Cleared" },
];

// Only the last 30 days are designed.
const PERIODS = [{ value: "30d", label: "Last 30 days" }];

/** The only container with a designed clearing form. */
const FORM_CONTAINER = "CAIU 2298076";

const focusRing = "rounded-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function ContainerCell({ container }: { container: string }) {
  return container === FORM_CONTAINER ? (
    // The row would navigate too, so the link keeps its own click.
    <Link href={`/clearing/${containerSlug(container)}`} onClick={(event) => event.stopPropagation()} className={`${focusRing} hover:underline`}>
      {container}
    </Link>
  ) : (
    // No handler: the click bubbles to the row (notInPrototype). The button makes the row keyboard-reachable.
    <button type="button" className={focusRing}>
      {container}
    </button>
  );
}

const sumCost = (rows: ClearingRow[]) => rows.reduce((sum, r) => sum + r.clearingCost, 0);

// Column widths from 26_9.1_Clearing_list.jpeg; Clearing cost takes the rest.
const columns: ColumnDef<ClearingRow>[] = [
  {
    accessorKey: "container",
    header: "Container",
    meta: { className: "w-[165px]" },
    cell: ({ row }) => <ContainerCell container={row.original.container} />,
    footer: ({ table }) => `Total, ${formatNumber(table.getCoreRowModel().rows.length)} containers`,
  },
  { accessorKey: "agent", header: "Clearing agent", meta: { className: "w-[194px]" } },
  {
    accessorKey: "arrivedAtPort",
    header: "Arrived at port",
    meta: { className: "w-[125px]" },
    cell: ({ row }) => formatShortDate(row.original.arrivedAtPort),
  },
  { accessorKey: "billOfEntry", header: "Bill of entry", meta: { className: "w-[116px]" } },
  { id: "orders", header: "Orders", meta: { className: "w-[162px]" }, cell: ({ row }) => row.original.orders.join(", ") },
  {
    accessorKey: "statusLabel",
    header: "Status",
    meta: { className: "w-[145px]" },
    cell: ({ row }) => <StatusPill tone={STATE_TONE[row.original.state]}>{row.original.statusLabel}</StatusPill>,
  },
  { accessorKey: "timeAtPort", header: "Time at port", meta: { className: "w-[110px]" } },
  {
    accessorKey: "clearingCost",
    header: "Clearing cost",
    meta: { align: "right", className: "font-bold" },
    cell: ({ row }) => formatINR(row.original.clearingCost),
    footer: ({ table }) => formatINR(sumCost(table.getCoreRowModel().rows.map((r) => r.original))),
  },
];

/** Clearing (India) list (26_9.1_Clearing_list.jpeg). Search, agent and status chips filter on the client. */
export function ClearingListScreen({ data }: { data: ClearingListData }) {
  const { kpis } = data;
  const router = useRouter();
  const [filters, setFilters] = useState<ClearingFilters>({ query: "", agent: ALL, state: ALL });
  const [period, setPeriod] = useState(PERIODS[0].value);
  const set = (patch: Partial<ClearingFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const rows = filterClearings(data.rows, filters);

  return (
    <>
      <PageHeader
        title="Clearing (India)"
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
            <Button asChild size="header" className="w-[150px]">
              <Link href={`/clearing/${containerSlug(FORM_CONTAINER)}`}>+ Record clearing</Link>
            </Button>
          </>
        }
      />
      <PageContainer>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-3">
            <FilterSelect
              label="Clearing agent"
              size="sm"
              value={filters.agent}
              options={[{ value: ALL, label: "All agents" }, ...data.agents.map((a) => ({ value: a, label: a }))]}
              onValueChange={(agent) => set({ agent })}
            />
            <FilterSelect label="Period" size="sm" value={period} options={PERIODS} onValueChange={setPeriod} />
          </div>
          <FilterChips
            label="Clearing status"
            size="sm"
            options={CHIPS}
            value={filters.state}
            onValueChange={(state) => set({ state: state as ClearingFilters["state"] })}
          />
        </div>

        <KpiRow gap="sm">
          <KpiCard size="xs" label="In clearing now" value={formatNumber(kpis.inClearingNow)} sub="nothing waiting at port" />
          <KpiCard size="xs" label="Cleared, last 30 days" value={formatNumber(kpis.clearedLast30Days)} sub="containers" />
          <KpiCard size="xs" label="Average time to clear" value={kpis.averageTimeToClear} sub="port to cleared" />
          <KpiCard size="xs" label="Clearing cost, last 30 days" value={formatINR(kpis.clearingCostLast30Days)} sub="duty, taxes and charges" />
        </KpiRow>

        <DataTable
          columns={columns}
          data={rows}
          getRowId={(r) => r.container}
          size="sm"
          onRowClick={(r) =>
            r.container === FORM_CONTAINER ? router.push(`/clearing/${containerSlug(r.container)}`) : notInPrototype(`Clearing for ${r.container}`)
          }
          emptyState="No containers match these filters."
        />
      </PageContainer>
    </>
  );
}
