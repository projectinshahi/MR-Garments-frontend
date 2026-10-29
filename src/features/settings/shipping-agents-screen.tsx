"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import type { ShippingAgentRow } from "@/lib/api/types";

import { actionClass, bold, contactSearch, right, SettingsList } from "./settings-list";
import { ADD_SHIPPING_AGENT_HREF, ShippingAgentDialog } from "./shipping-agents-dialog";

const shippingColumns: ColumnDef<ShippingAgentRow>[] = [
  { accessorKey: "name", header: "Shipping agent", meta: bold },
  { accessorKey: "contactPerson", header: "Contact person" },
  { accessorKey: "phone", header: "Phone" },
  { accessorKey: "officeCity", header: "Office city" },
  { accessorKey: "activeContainers", header: "Active containers", meta: right },
];

/** 41_15.2_Shipping_agents.jpeg, plus the Add and Edit shipping agent dialog at ?dialog=add and ?dialog=edit&id=. */
export function ShippingAgentsScreen({ rows }: { rows: ShippingAgentRow[] }) {
  return (
    <>
      <SettingsList
        path="/settings/shipping-agents"
        rows={rows}
        columns={shippingColumns}
        searchText={contactSearch}
        noun="shipping agents"
        footnote="The shipping agent looks after the container from China to the Indian port. The agent does not log in."
        action={
          <Button asChild size="header" className={actionClass}>
            <Link href={ADD_SHIPPING_AGENT_HREF} replace scroll={false}>
              + Add shipping agent
            </Link>
          </Button>
        }
      />
      <Suspense fallback={null}>
        <ShippingAgentDialog agents={rows} />
      </Suspense>
    </>
  );
}
