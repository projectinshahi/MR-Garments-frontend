"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { RouteTabs, type RouteTab } from "@/components/layout/route-tabs";
import { DataTable } from "@/components/shared/data-table";
import { FilterChips, SearchInput } from "@/components/shared/filters";
import { notInPrototype } from "@/components/shared/prototype";
import { StatusPill } from "@/components/shared/status-pill";
import type { RecordStatus } from "@/types/domain";

import { filterRecords, type StatusFilter } from "./settings-logic";

export const SETTINGS_TABS: RouteTab[] = [
  { href: "/settings/suppliers", label: "Suppliers", chip: "1" },
  { href: "/settings/shipping-agents", label: "Shipping agents", chip: "2" },
  { href: "/settings/clearing-agents", label: "Clearing agents", chip: "3" },
  { href: "/settings/transport-companies", label: "Transport companies", chip: "4" },
  { href: "/settings/offices", label: "Offices & warehouses", chip: "5" },
  { href: "/settings/teams", label: "Teams", chip: "6" },
  { href: "/settings/items", label: "Item list", chip: "7" },
];

const STATUS_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
  { value: "All", label: "All" },
];

type SettingsRecord = { id: string; name: string; status: RecordStatus };

function trailingColumns<T extends SettingsRecord>(): ColumnDef<T>[] {
  return [
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusPill tone={row.original.status === "Active" ? "success" : "neutral"}>{row.original.status}</StatusPill>
      ),
    },
    {
      id: "edit",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <button
          type="button"
          aria-label={`Edit ${row.original.name}`}
          onClick={() => notInPrototype(`Edit ${row.original.name}`)}
          className="rounded-sm font-bold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Edit
        </button>
      ),
    },
  ];
}

/**
 * One Settings tab (40–46): header with the tab's add action, the 1–7 tab bar, search and status chips, the
 * table (status pill and Edit appended) and the tab's footnote.
 */
export function SettingsList<T extends SettingsRecord>({
  rows,
  columns,
  searchText,
  action,
  footnote,
  noun,
}: {
  rows: T[];
  /** The tab's own columns; Status and Edit are appended. */
  columns: ColumnDef<T>[];
  /** Values the search matches: name and phone, or the closest visible columns. */
  searchText: (row: T) => string[];
  action: React.ReactNode;
  footnote: string;
  /** Plural record noun for the empty state ("suppliers"). */
  noun: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("Active");
  const allColumns = useMemo(() => [...columns, ...trailingColumns<T>()], [columns]);
  const visible = filterRecords(rows, { query, status }, searchText);

  return (
    <>
      <PageHeader title="Settings" actions={action} />
      <RouteTabs tabs={SETTINGS_TABS} label="Settings sections" />
      <PageContainer>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchInput
            label="Search by name or phone"
            inlineLabel="Search"
            placeholder="name or phone"
            value={query}
            onValueChange={setQuery}
            // 40–46 draw a 168 px box; the shared 15 px placeholder needs this width to show "name or phone" uncut.
            className="w-[194px] gap-2 bg-card"
          />
          <FilterChips
            label="Status"
            size="sm"
            options={STATUS_OPTIONS}
            value={status}
            onValueChange={(value) => setStatus(value as StatusFilter)}
          />
        </div>
        <div className="flex flex-col gap-[15px]">
          <DataTable
            columns={allColumns}
            data={visible}
            getRowId={(row) => row.id}
            size="sm"
            emptyState={`No ${noun} match these filters.`}
          />
          <p className="text-[12.5px] leading-5 text-muted-foreground">{footnote}</p>
        </div>
      </PageContainer>
    </>
  );
}
