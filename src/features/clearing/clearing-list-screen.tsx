"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useNavigate } from "@/components/layout/navigation-progress";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { KpiCard, KpiRow } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { FilterChips, FilterSelect, SearchInput } from "@/components/shared/filters";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { ACTIONS_COLUMN_CLASS, DeleteRecordButton, RecordFacts } from "@/features/order-detail/shared/delete-record";
import { ReportDownload } from "@/features/reports/report-actions";
import { describeFilters } from "@/features/reports/report-files";
import type { ClearingListRow } from "@/lib/api/stages-types";
import { formatDate, formatNumber, formatShortDate } from "@/lib/formatters";
import type { Tone } from "@/types/domain";

import { clearingFile } from "./clearing-files";
import { ALL, clearingState, clearingStatusLabel, filterClearings, timeAtPort, type ClearingFilters, type ClearingState } from "./clearing-logic";
import type { ClearingListData } from "./data/queries";
import { formatExactINR } from "./stage-form";

const STATE_TONE: Record<ClearingState, Tone> = { waiting: "warning", duty: "info", cleared: "success" };

const CHIPS = [
  { value: ALL, label: "All" },
  { value: "waiting", label: "Waiting for agent" },
  { value: "duty", label: "Duty to pay" },
  { value: "cleared", label: "Cleared" },
];

// Only the last 30 days are designed; the KPIs count them, the table lists every arrived container.
const PERIODS = [{ value: "30d", label: "Last 30 days" }];

const focusRing = "rounded-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const formHref = (row: ClearingListRow) => `/clearing/${row.containerId}`;
const sumCost = (rows: ClearingListRow[]) => rows.reduce((sum, r) => sum + r.clearingCostInr, 0);

// Clicks inside the Actions cell (its dialog's too: a portal, but they bubble through React) must not open the row.
const stop = (event: React.MouseEvent) => event.stopPropagation();

/** CLR-4: the clearing of one container. The confirmation names what depends on it (a trip refuses the delete). */
function DeleteClearing({ row }: { row: ClearingListRow }) {
  const trip = row.trip;
  return (
    <DeleteRecordButton
      path={`/clearings/${row.containerId}`}
      noun="clearing"
      label={`Delete clearing of container ${row.number}`}
      title="Delete Clearing?"
      description={
        <>
          <p>
            Are you sure you want to delete the clearing of container <strong className="text-foreground">{row.number}</strong>? This can&apos;t be
            undone.
          </p>
          <RecordFacts
            facts={[
              ["Status", clearingStatusLabel(row)],
              ["Clearing agent", row.agent?.name ?? "–"],
              ["Arrived at port", row.arrivedOn ? formatDate(row.arrivedOn) : "–"],
              ["Bill of entry", row.billOfEntry || "–"],
              ["Clearing cost", formatExactINR(row.clearingCostInr)],
              ["Orders", row.orders.join(", ") || "–"],
            ]}
          />
          {trip ? (
            <p className="font-bold text-foreground">
              {trip.warehouseReceipt
                ? `Transport trip ${trip.lrNumber} and its ${trip.warehouseReceipt} warehouse receipt depend on this clearing, so it can't be deleted: warehouse receipts can't be removed in the app.`
                : `Transport trip ${trip.lrNumber} (${trip.status === "on_road" ? "on the way" : "unloaded"}) depends on this clearing, so it can't be deleted until that trip is deleted.`}
            </p>
          ) : (
            <p className="font-bold text-foreground">
              Its duty and charges leave the landed cost, and the container goes back to waiting for clearing.
            </p>
          )}
          <p>Payments aren&apos;t affected. A clearing with a transport trip can&apos;t be deleted.</p>
        </>
      }
    />
  );
}

// Column widths from 26_9.1_Clearing_list.jpeg; Clearing cost takes the rest. With Actions (canDelete, Management, no
// reference) the clearing agent gives up its fixed width, so the table still fits the 1440 px page.
const columnsFor = (today: string, canDelete: boolean): ColumnDef<ClearingListRow>[] => [
  {
    accessorKey: "number",
    header: "Container",
    meta: { className: "w-[165px]" },
    // The row would navigate too, so the link keeps its own click.
    cell: ({ row }) => (
      <Link href={formHref(row.original)} onClick={(event) => event.stopPropagation()} className={`${focusRing} hover:underline`}>
        {row.original.number}
      </Link>
    ),
    footer: ({ table }) => `Total, ${formatNumber(table.getCoreRowModel().rows.length)} containers`,
  },
  { id: "agent", header: "Clearing agent", meta: { className: canDelete ? undefined : "w-[194px]" }, cell: ({ row }) => row.original.agent?.name ?? "–" },
  {
    id: "arrivedOn",
    header: "Arrived at port",
    meta: { className: "w-[125px]" },
    cell: ({ row }) => (row.original.arrivedOn ? formatShortDate(row.original.arrivedOn) : "–"),
  },
  { id: "billOfEntry", header: "Bill of entry", meta: { className: "w-[116px]" }, cell: ({ row }) => row.original.billOfEntry || "–" },
  { id: "orders", header: "Orders", meta: { className: "w-[162px]" }, cell: ({ row }) => row.original.orders.join(", ") },
  {
    id: "status",
    header: "Status",
    meta: { className: "w-[145px]" },
    cell: ({ row }) => <StatusPill tone={STATE_TONE[clearingState(row.original)]}>{clearingStatusLabel(row.original)}</StatusPill>,
  },
  ...(canDelete
    ? [
        {
          id: "actions",
          header: "Actions",
          meta: { className: `w-[72px] ${ACTIONS_COLUMN_CLASS}` },
          // Only a container with a clearing record has one to delete.
          cell: ({ row }) =>
            row.original.status === "waiting" ? null : (
              <span onClick={stop}>
                <DeleteClearing row={row.original} />
              </span>
            ),
        } satisfies ColumnDef<ClearingListRow>,
      ]
    : []),
  { id: "timeAtPort", header: "Time at port", meta: { className: "w-[110px]" }, cell: ({ row }) => timeAtPort(row.original, today) },
  {
    id: "clearingCost",
    header: "Clearing cost",
    meta: { align: "right", className: "font-bold" },
    cell: ({ row }) => (row.original.status === "waiting" ? "–" : formatExactINR(row.original.clearingCostInr)),
    footer: ({ table }) => formatExactINR(sumCost(table.getCoreRowModel().rows.map((r) => r.original))),
  },
];

/**
 * Clearing (India) list (26_9.1_Clearing_list.jpeg), from CLR-1: every arrived container, so the ones waiting for
 * the agent or the duty are rows too. Search, agent and status chips filter on the client.
 */
export function ClearingListScreen({ data }: { data: ClearingListData }) {
  const { kpis, today, canEnter, canDelete } = data;
  const navigate = useNavigate();
  const columns = useMemo(() => columnsFor(today, canDelete), [today, canDelete]);
  const [filters, setFilters] = useState<ClearingFilters>({ query: "", agent: ALL, state: ALL });
  const [period, setPeriod] = useState(PERIODS[0].value);
  const set = (patch: Partial<ClearingFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const rows = filterClearings(data.rows, filters);
  // "+ Record clearing" opens the container that has waited longest.
  const next = data.rows.filter((r) => r.status !== "cleared").at(-1);

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
            <ReportDownload
              file={() =>
                clearingFile(
                  rows,
                  kpis,
                  describeFilters([
                    filters.query.trim() && `Search: "${filters.query.trim()}"`,
                    filters.agent !== ALL && `Clearing agent: ${data.agents.find((a) => a.id === filters.agent)?.name ?? filters.agent}`,
                    filters.state !== ALL && `Status: ${CHIPS.find((c) => c.value === filters.state)?.label}`,
                  ]),
                  today,
                )
              }
            />
            {canEnter ? (
              next ? (
                <Button asChild size="header" className="w-[150px]">
                  <Link href={formHref(next)}>+ Record clearing</Link>
                </Button>
              ) : (
                <Button size="header" className="w-[150px]" disabled title="No container is waiting for clearing">
                  + Record clearing
                </Button>
              )
            ) : null}
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
              options={[{ value: ALL, label: "All agents" }, ...data.agents.map((a) => ({ value: a.id, label: a.name }))]}
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
          <KpiCard
            size="xs"
            label="In clearing now"
            value={formatNumber(kpis.inClearingNow)}
            sub={kpis.inClearingNow ? `${kpis.inClearingNow === 1 ? "container" : "containers"} at the port` : "nothing waiting at port"}
          />
          <KpiCard size="xs" label="Cleared, last 30 days" value={formatNumber(kpis.clearedLast30Days)} sub="containers" />
          <KpiCard
            size="xs"
            label="Average time to clear"
            value={kpis.averageDaysToClear === null ? "–" : `${formatNumber(kpis.averageDaysToClear, 1)} days`}
            sub="port to cleared"
          />
          <KpiCard size="xs" label="Clearing cost, last 30 days" value={formatExactINR(kpis.clearingCostLast30DaysInr)} sub="duty, taxes and charges" />
        </KpiRow>

        <DataTable
          columns={columns}
          data={rows}
          getRowId={(r) => r.containerId}
          size="sm"
          header="tall"
          onRowClick={(r) => navigate(formHref(r))}
          emptyState={data.rows.length ? "No containers match these filters." : "No container has arrived yet."}
        />
      </PageContainer>
    </>
  );
}
