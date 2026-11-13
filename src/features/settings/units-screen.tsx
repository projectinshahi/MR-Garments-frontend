"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import type { UnitRow } from "@/lib/api/types";

import { addHref, orDash } from "./settings-dialog";
import { actionClass, bold, SettingsList, type SettingsReport, textColumns } from "./settings-list";
import { UnitDialog, unitDeletable, UNITS_PATH } from "./units-dialog";

const unitColumns: ColumnDef<UnitRow>[] = [
  { accessorKey: "name", header: "Unit", meta: bold },
  { accessorKey: "symbol", header: "Symbol", cell: ({ row }) => orDash(row.original.symbol) },
  {
    accessorKey: "usedByItems",
    header: "Used by items",
    meta: { className: "whitespace-normal" },
    cell: ({ row }) => row.original.usedByItems.join(", "),
  },
];

const report: SettingsReport<UnitRow> = {
  title: "Units",
  slug: "units",
  columns: textColumns("Unit", "Symbol", "Used by items", "Status"),
  row: (r) => [r.name, r.symbol || null, r.usedByItems.join(", ") || null, r.status],
};

/** Settings tab 8, Units (no reference design; built like Teams), plus the add and edit dialogs (?dialog=add, ?dialog=edit&id=). */
export function UnitsScreen({ rows }: { rows: UnitRow[] }) {
  return (
    <>
      <SettingsList
        path={UNITS_PATH}
        rows={rows}
        columns={unitColumns}
        searchText={(row) => [row.name, row.symbol]}
        noun="units"
        report={report}
        deletable={unitDeletable}
        footnote="Items are counted in these units. The symbol shows after quantities on orders, receipts and reports."
        action={
          <Button asChild size="header" className={actionClass}>
            <Link href={addHref(UNITS_PATH)} replace scroll={false}>
              + Add unit
            </Link>
          </Button>
        }
      />
      <Suspense fallback={null}>
        <UnitDialog rows={rows} />
      </Suspense>
    </>
  );
}
