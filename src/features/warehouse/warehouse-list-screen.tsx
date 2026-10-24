"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { KpiCard, KpiRow } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { FilterSelect, SearchInput } from "@/components/shared/filters";
import { notInPrototype } from "@/components/shared/prototype";
import { Button } from "@/components/ui/button";
import { formatDate, formatINR, formatNumber, formatQty } from "@/lib/formatters";

import type { WarehouseListData, WarehouseReceipt } from "./data/queries";
import { filterReceipts, summarizeReceipts } from "./warehouse-logic";

type Totals = ReturnType<typeof summarizeReceipts>;

const ALL = "all";
const LAST_30_DAYS = "30d";

// Measured from 30_11.1_Warehouse_list.jpeg: a 38 px header row, 65 px rows (two-line item cell) and a 43 px totals
// row. DataTable has no such density, so the cell contents carry the measured heights.
function Head({ children }: { children: React.ReactNode }) {
  return <span className="block leading-[38px]">{children}</span>;
}
function Foot({ children }: { children: React.ReactNode }) {
  return <span className="block pt-[6px] pb-px leading-5">{children}</span>;
}

const TEAM_COLUMNS = [
  { key: "received", label: "Received", width: "w-[96.5px]" },
  { key: "retail", label: "Retail", width: "w-[73.5px]" },
  { key: "wholesale", label: "Wholesale", width: "w-[105.5px]" },
  { key: "online", label: "Online", width: "w-[78.5px]" },
] as const;

/** Column widths measured from the reference; the totals row follows the rows shown. */
const columnsFor = (totals: Totals): ColumnDef<WarehouseReceipt>[] => [
  { accessorKey: "receivedOn", header: () => <Head>Received on</Head>, cell: ({ row }) => formatDate(row.original.receivedOn), footer: () => <Foot>Total</Foot>, meta: { className: "w-[126px]" } },
  {
    accessorKey: "item",
    header: () => <Head>Item</Head>,
    cell: ({ row }) => (
      <div className="flex min-h-12 flex-col justify-center">
        <span className="leading-[18px] font-bold">{row.original.item}</span>
        <span className="text-[12.5px] leading-4 text-muted-foreground">
          {row.original.po} · {row.original.supplier}
        </span>
      </div>
    ),
    footer: () => <Foot>{`${totals.items} ${totals.items === 1 ? "item" : "items"}`}</Foot>,
    meta: { className: "w-[252px]" },
  },
  { accessorKey: "container", header: () => <Head>Container</Head>, meta: { className: "w-[150px]" } },
  ...TEAM_COLUMNS.map(
    ({ key, label, width }): ColumnDef<WarehouseReceipt> => ({
      accessorKey: key,
      header: () => <Head>{label}</Head>,
      cell: ({ row }) => formatNumber(row.original[key]),
      footer: () => <Foot>{formatNumber(totals[key])}</Foot>,
      meta: { align: "right", className: width },
    }),
  ),
  { accessorKey: "receivedBy", header: () => <Head>Received by</Head>, meta: { className: "w-[130px]" } },
  {
    accessorKey: "costPerPiece",
    header: () => <Head>Cost per piece</Head>,
    cell: ({ row }) => formatINR(row.original.costPerPiece, 2),
    footer: () => <Foot>{formatINR(totals.costPerPiece, 2)}</Foot>,
    meta: { align: "right", className: "w-[122px]" },
  },
];

/** Warehouse list (30_11.1_Warehouse_list.jpeg). Search narrows the receipts and the totals row on the client. */
export function WarehouseListScreen({ data }: { data: WarehouseListData }) {
  const [query, setQuery] = useState("");
  const [warehouse, setWarehouse] = useState(data.warehouses[0]);
  const rows = filterReceipts(data.receipts, query);
  const stock = summarizeReceipts(data.receipts);
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
              value={query}
              onValueChange={setQuery}
              className="hidden w-[170px] sm:flex lg:w-[250px]"
            />
            <Button asChild size="header" className="px-4">
              <Link href="/warehouse/receive">+ Receive goods</Link>
            </Button>
          </>
        }
      />
      <PageContainer>
        <div className="flex flex-wrap gap-3">
          <FilterSelect
            label="Warehouse"
            size="sm"
            value={warehouse}
            options={data.warehouses.map((w) => ({ value: w, label: w }))}
            onValueChange={setWarehouse}
          />
          <FilterSelect
            label="Team"
            size="sm"
            value={ALL}
            options={[{ value: ALL, label: "All teams" }, ...data.teams.map((t) => ({ value: t, label: t }))]}
            onValueChange={(team) => {
              if (team !== ALL) notInPrototype("Filter by team");
            }}
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
          <KpiCard size="xs" label="Received in stock" value={formatQty(stock.received, "pcs")} sub={`${stock.items} items`} />
          <KpiCard size="xs" label="Retail team" value={formatQty(stock.retail, "pcs")} />
          <KpiCard size="xs" label="Wholesale team" value={formatQty(stock.wholesale, "pcs")} />
          <KpiCard size="xs" label="Online team" value={formatQty(stock.online, "pcs")} />
        </KpiRow>

        <DataTable
          columns={columnsFor(totals)}
          data={rows}
          getRowId={(r) => r.id}
          size="sm"
          density="compact"
          emptyState="No items match this search."
        />
        <p className="mt-[2px] text-[12.5px] leading-5 text-muted-foreground">
          Cost per piece is shown to management only. Warehouse staff see quantities.
        </p>
      </PageContainer>
    </>
  );
}
