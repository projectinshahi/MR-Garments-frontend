"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import type { ClearingAgentRow } from "@/lib/api/types";

import { ADD_CLEARING_AGENT_HREF, CLEARING_AGENTS_PATH, ClearingAgentDialogs, clearingAgentDeletable } from "./clearing-agents-dialog";
import { actionClass, bold, contactSearch, right, SettingsList, type SettingsReport, textColumns } from "./settings-list";

const clearingColumns: ColumnDef<ClearingAgentRow>[] = [
  { accessorKey: "name", header: "Clearing agent", meta: bold },
  { accessorKey: "contactPerson", header: "Contact person" },
  { accessorKey: "phone", header: "Phone" },
  { accessorKey: "port", header: "Port" },
  { accessorKey: "containersCleared", header: "Containers cleared", meta: right },
];

const report: SettingsReport<ClearingAgentRow> = {
  title: "Clearing agents",
  slug: "clearing-agents",
  columns: textColumns("Clearing agent", "Contact person", "Phone", "Port", "Containers cleared", "Status"),
  row: (r) => [r.name, r.contactPerson || null, r.phone || null, r.port || null, r.containersCleared, r.status],
};

/** 42_15.3_Clearing_agents.jpeg, plus the Add and Edit dialogs (no reference) at ?dialog=add and ?dialog=edit&id=. */
export function ClearingAgentsScreen({ rows }: { rows: ClearingAgentRow[] }) {
  return (
    <>
      <SettingsList
        path={CLEARING_AGENTS_PATH}
        rows={rows}
        columns={clearingColumns}
        searchText={contactSearch}
        noun="clearing agents"
        report={report}
        deletable={clearingAgentDeletable}
        footnote="Clearing agents do not log in. Staff enter their figures from the agent’s papers."
        action={
          <Button asChild size="header" className={actionClass}>
            <Link href={ADD_CLEARING_AGENT_HREF} replace scroll={false}>
              + Add clearing agent
            </Link>
          </Button>
        }
      />
      <Suspense fallback={null}>
        <ClearingAgentDialogs rows={rows} />
      </Suspense>
    </>
  );
}
