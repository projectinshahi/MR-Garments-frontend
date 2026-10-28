"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { LocationRow } from "@/lib/api/types";

import { bold, PrototypeAction, SettingsList } from "./settings-list";

const locationColumns: ColumnDef<LocationRow>[] = [
  { accessorKey: "name", header: "Name", meta: bold },
  { accessorKey: "type", header: "Type" },
  { accessorKey: "country", header: "Country" },
  { accessorKey: "address", header: "Address" },
  { accessorKey: "staff", header: "Staff", cell: ({ row }) => row.original.staff.join(", ") },
];

/** 44_15.5_Offices_&_warehouses.jpeg */
export function OfficesScreen({ rows }: { rows: LocationRow[] }) {
  return (
    <SettingsList
      path="/settings/offices"
      rows={rows}
      columns={locationColumns}
      searchText={(row) => [row.name, row.address, ...row.staff]}
      noun="offices or warehouses"
      footnote="Offices are used in Receiving (China). Warehouses are used when goods are received in India."
      action={<PrototypeAction label="Add office or warehouse" />}
    />
  );
}
