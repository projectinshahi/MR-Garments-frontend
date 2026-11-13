"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import type { LocationRow } from "@/lib/api/types";

import { OfficeDialog, officeDeletable, OFFICES_PATH } from "./offices-dialog";
import { addHref } from "./settings-dialog";
import { actionClass, bold, SettingsList, type SettingsReport, textColumns } from "./settings-list";

const locationColumns: ColumnDef<LocationRow>[] = [
  { accessorKey: "name", header: "Name", meta: bold },
  { accessorKey: "type", header: "Type" },
  { accessorKey: "country", header: "Country" },
  { accessorKey: "address", header: "Address" },
  { accessorKey: "staff", header: "Staff", cell: ({ row }) => row.original.staff.join(", ") },
];

const report: SettingsReport<LocationRow> = {
  title: "Offices and warehouses",
  slug: "offices-warehouses",
  columns: textColumns("Name", "Type", "Country", "Address", "Staff", "Status"),
  row: (r) => [r.name, r.type, r.country, r.address || null, r.staff.join(", ") || null, r.status],
};

/** 44_15.5_Offices_&_warehouses.jpeg, plus the add and edit dialogs (?dialog=add, ?dialog=edit&id=). */
export function OfficesScreen({ rows }: { rows: LocationRow[] }) {
  return (
    <>
      <SettingsList
        path={OFFICES_PATH}
        rows={rows}
        columns={locationColumns}
        searchText={(row) => [row.name, row.address, ...row.staff]}
        noun="offices or warehouses"
        report={report}
        deletable={officeDeletable}
        footnote="Offices are used in Receiving (China). Warehouses are used when goods are received in India."
        action={
          <Button asChild size="header" className={actionClass}>
            <Link href={addHref(OFFICES_PATH)} replace scroll={false}>
              + Add office or warehouse
            </Link>
          </Button>
        }
      />
      <Suspense fallback={null}>
        <OfficeDialog rows={rows} />
      </Suspense>
    </>
  );
}
