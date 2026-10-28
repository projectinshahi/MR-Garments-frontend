"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { ShippingAgentRow } from "@/lib/api/types";

import { bold, contactSearch, PrototypeAction, right, SettingsList } from "./settings-list";

const shippingColumns: ColumnDef<ShippingAgentRow>[] = [
  { accessorKey: "name", header: "Shipping agent", meta: bold },
  { accessorKey: "contactPerson", header: "Contact person" },
  { accessorKey: "phone", header: "Phone" },
  { accessorKey: "officeCity", header: "Office city" },
  { accessorKey: "activeContainers", header: "Active containers", meta: right },
];

/** 41_15.2_Shipping_agents.jpeg */
export function ShippingAgentsScreen({ rows }: { rows: ShippingAgentRow[] }) {
  return (
    <SettingsList
      path="/settings/shipping-agents"
      rows={rows}
      columns={shippingColumns}
      searchText={contactSearch}
      noun="shipping agents"
      footnote="The shipping agent looks after the container from China to the Indian port. The agent does not log in."
      action={<PrototypeAction label="Add shipping agent" />}
    />
  );
}
