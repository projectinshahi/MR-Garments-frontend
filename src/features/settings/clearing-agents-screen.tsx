"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { ClearingAgentRow } from "@/lib/api/types";

import { bold, contactSearch, PrototypeAction, right, SettingsList } from "./settings-list";

const clearingColumns: ColumnDef<ClearingAgentRow>[] = [
  { accessorKey: "name", header: "Clearing agent", meta: bold },
  { accessorKey: "contactPerson", header: "Contact person" },
  { accessorKey: "phone", header: "Phone" },
  { accessorKey: "port", header: "Port" },
  { accessorKey: "containersCleared", header: "Containers cleared", meta: right },
];

/** 42_15.3_Clearing_agents.jpeg */
export function ClearingAgentsScreen({ rows }: { rows: ClearingAgentRow[] }) {
  return (
    <SettingsList
      path="/settings/clearing-agents"
      rows={rows}
      columns={clearingColumns}
      searchText={contactSearch}
      noun="clearing agents"
      footnote="Clearing agents do not log in. Staff enter their figures from the agent’s papers."
      action={<PrototypeAction label="Add clearing agent" />}
    />
  );
}
