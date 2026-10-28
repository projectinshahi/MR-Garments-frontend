"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { TransportCompanyRow } from "@/lib/api/types";

import { bold, contactSearch, PrototypeAction, right, SettingsList } from "./settings-list";

// As drawn in 43: the phone column is right-aligned and "Trips so far" left-aligned.
const transportColumns: ColumnDef<TransportCompanyRow>[] = [
  { accessorKey: "name", header: "Transport company", meta: bold },
  { accessorKey: "contactPerson", header: "Contact person" },
  { accessorKey: "phone", header: "Phone", meta: right },
  { accessorKey: "tripsSoFar", header: "Trips so far" },
];

/** 43_15.4_Transport_companies.jpeg */
export function TransportCompaniesScreen({ rows }: { rows: TransportCompanyRow[] }) {
  return (
    <SettingsList
      path="/settings/transport-companies"
      rows={rows}
      columns={transportColumns}
      searchText={contactSearch}
      noun="transport companies"
      footnote="Transport companies do not log in."
      action={<PrototypeAction label="Add transport company" />}
    />
  );
}
