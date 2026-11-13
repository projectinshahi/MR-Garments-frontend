"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useState } from "react";

import { useNavigate } from "@/components/layout/navigation-progress";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { CardNote, KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { FilterSelect, SearchInput } from "@/components/shared/filters";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { ACTIONS_COLUMN_CLASS, DeleteRecordButton, PLAIN_ACTIONS_COLUMN_CLASS, RecordFacts } from "@/features/order-detail/shared/delete-record";
import { ReportDownload } from "@/features/reports/report-actions";
import { describeFilters } from "@/features/reports/report-files";
import type { WarehouseList, WarehouseListRow } from "@/lib/api/stages-types";
import { formatDate, formatINR, formatNumber, formatQty, formatShortDate } from "@/lib/formatters";
import { todayInIndia } from "@/lib/today";

import type { WarehouseListData } from "./data/queries";
import { warehouseFile } from "./warehouse-files";
import { ALL, filterReceipts, summarizeReceipts, teamLabel, type ReceiptFilters } from "./warehouse-logic";

type Totals = ReturnType<typeof summarizeReceipts>;
type Team = WarehouseList["teams"][number];

const LAST_30_DAYS = "30d";
// Measured from the reference for its three teams; more teams share the remaining width.
const TEAM_WIDTHS = ["w-[73.5px]", "w-[105.5px]", "w-[78.5px]"];

const focusRing = "rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const receiveHref = (transportId: string) => `/warehouse/receive/${transportId}`;
// Clicks inside an Actions cell (its dialog's too: a portal, but they bubble through React) must not open the row.
const stop = (event: React.MouseEvent) => event.stopPropagation();

/** "Retail 60 · Wholesale 40": pieces per team, in the teams' order; a team no longer listed counts as "Other teams". */
function splitText(split: Record<string, number>, teams: Team[]) {
  const named = teams.filter((team) => (split[team.id] ?? 0) > 0).map((team) => `${teamLabel(team.name)} ${formatNumber(split[team.id]!)}`);
  const other = Object.entries(split).reduce((sum, [id, pieces]) => (teams.some((team) => team.id === id) ? sum : sum + pieces), 0);
  return [...named, ...(other > 0 ? [`Other teams ${formatNumber(other)}`] : [])].join(" · ") || "None yet";
}

const DeleteNote = () => <p>Payments, the trip and the clearing aren&apos;t affected.</p>;

/** WH-4 of a stocked receipt, from one of its rows: the receipt covers every order in the trip, filtered out or not. */
function DeleteStocked({ row, all, teams }: { row: WarehouseListRow; all: WarehouseListRow[]; teams: Team[] }) {
  const mine = all.filter((r) => r.receiptId === row.receiptId);
  const split: Record<string, number> = {};
  for (const r of mine) for (const [id, pieces] of Object.entries(r.teams)) split[id] = (split[id] ?? 0) + pieces;
  const pos = mine.map((r) => r.po).join(", ");
  const received = mine.reduce((sum, r) => sum + r.received, 0);
  return (
    <DeleteRecordButton
      path={`/warehouse-receipts/${row.transportId}`}
      noun="warehouse receipt"
      label={`Delete warehouse receipt of ${row.po}, container ${row.container}`}
      title="Delete Warehouse Receipt?"
      description={
        <>
          <p>
            Are you sure you want to delete the warehouse receipt of {row.lrNumber ? <>trip <strong className="whitespace-nowrap text-foreground">{row.lrNumber}</strong> </> : null}
            (container <strong className="text-foreground">{row.container}</strong>)? This can&apos;t be undone.
          </p>
          <RecordFacts
            facts={[
              ["Status", "Completed, in stock"],
              ["Orders", pos],
              ["Warehouse", row.location.name],
              ["Received on", formatDate(row.receivedOn)],
              ["Received", `${formatQty(received, "pcs")}${row.bundlesReceived === undefined ? "" : ` · ${formatNumber(row.bundlesReceived)} bundles`}`],
              ["Teams", splitText(split, teams)],
            ]}
          />
          <p className="font-bold text-foreground">
            Its goods leave stock: these team quantities are removed, the cost per piece of {pos} is no longer final, and the trip goes back to
            waiting to be received.
          </p>
          <DeleteNote />
        </>
      }
    />
  );
}

/** WH-4 of a draft: nothing of it is in stock yet. */
function DeleteDraft({ trip, teams }: { trip: Ready; teams: Team[] }) {
  const draft = trip.draft;
  return (
    <DeleteRecordButton
      path={`/warehouse-receipts/${trip.transportId}`}
      noun="warehouse receipt"
      label={`Delete draft warehouse receipt of trip ${trip.lrNumber}`}
      title="Delete Warehouse Receipt?"
      description={
        <>
          <p>
            Are you sure you want to delete the draft warehouse receipt of trip <strong className="whitespace-nowrap text-foreground">{trip.lrNumber}</strong>{" "}
            (container <strong className="text-foreground">{trip.container}</strong>)? This can&apos;t be undone.
          </p>
          <RecordFacts
            facts={[
              ["Status", "Draft"],
              ["Orders", trip.orders.join(", ") || "–"],
              ["Warehouse", draft?.location ?? trip.destination],
              ["Received on", draft ? formatDate(draft.receivedOn) : "–"],
              ["Received", draft ? `${formatQty(draft.received, "pcs")} · ${formatNumber(draft.bundlesReceived)} bundles` : "–"],
              ["Teams", draft ? splitText(draft.teams, teams) : "–"],
            ]}
          />
          <p className="font-bold text-foreground">
            Only the draft goes: nothing of it is in stock, so stock, costs and order stages don&apos;t change. The trip stays waiting to be received.
          </p>
          <DeleteNote />
        </>
      }
    />
  );
}

/**
 * Column widths measured from the reference; the totals row follows the rows shown. With Actions (canDelete, Management,
 * no reference; the table has no Status, so it comes last) the item gives up its fixed width so the table still fits.
 */
const columnsFor = (teams: Team[], totals: Totals, showCosts: boolean, canDelete: boolean, all: WarehouseListRow[]): ColumnDef<WarehouseListRow>[] => [
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
    meta: { className: canDelete ? undefined : "w-[252px]" },
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
  ...(canDelete
    ? [
        {
          id: "actions",
          header: "Actions",
          meta: { className: `w-[72px] ${ACTIONS_COLUMN_CLASS}` },
          cell: ({ row }) => <DeleteStocked row={row.original} all={all} teams={teams} />,
        } satisfies ColumnDef<WarehouseListRow>,
      ]
    : []),
];

type Ready = WarehouseList["ready"][number];
/** Trips waiting to be received; with Actions (canDelete) right after Status: Delete on a draft only. */
const readyColumnsFor = (canDelete: boolean, teams: Team[]): ColumnDef<Ready>[] => [
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
  ...(canDelete
    ? [
        {
          id: "actions",
          header: "Actions",
          meta: { className: `w-[72px] ${PLAIN_ACTIONS_COLUMN_CLASS}` },
          // A trip not started has no receipt to delete.
          cell: ({ row }) =>
            row.original.receiptStatus === "draft" ? (
              <span onClick={stop}>
                <DeleteDraft trip={row.original} teams={teams} />
              </span>
            ) : null,
        } satisfies ColumnDef<Ready>,
      ]
    : []),
];

/**
 * Warehouse list (30_11.1_Warehouse_list.jpeg), from WH-1: one row per order per receipt in stock, a column per active
 * team. Warehouse, team and search narrow the rows and the totals on the client; the KPIs follow the warehouse.
 * Below the designed table, the unloaded trips still waiting to be received.
 */
export function WarehouseListScreen({ data }: { data: WarehouseListData }) {
  const { teams, ready, showCosts, canEnter, canDelete } = data;
  const navigate = useNavigate();
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
            <ReportDownload
              file={() =>
                warehouseFile(rows, data.rows, data, {
                  showCosts,
                  filters: describeFilters([
                    filters.query.trim() && `Search: "${filters.query.trim()}"`,
                    `Warehouse: ${data.warehouses.find((w) => w.id === filters.warehouse)?.name ?? "All warehouses"}`,
                    filters.team !== ALL && `Team: ${teams.find((t) => t.id === filters.team)?.name ?? filters.team}`,
                  ]),
                  today: todayInIndia(),
                })
              }
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
          columns={columnsFor(teams, totals, showCosts, canDelete, data.rows)}
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
              columns={readyColumnsFor(canDelete, teams)}
              data={ready}
              getRowId={(r) => r.transportId}
              variant="plain"
              density="loose"
              className="mt-3"
              onRowClick={(r) => navigate(receiveHref(r.transportId))}
            />
          </SectionCard>
        ) : null}
      </PageContainer>
    </>
  );
}
