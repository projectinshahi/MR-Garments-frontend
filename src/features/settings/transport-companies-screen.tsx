"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import type { TransportCompanyRow } from "@/lib/api/types";

import { actionClass, bold, contactSearch, right, SettingsList } from "./settings-list";
import { ADD_TRANSPORT_COMPANY_HREF, TRANSPORT_COMPANIES_PATH, TransportCompanyDialogs } from "./transport-companies-dialog";

// As drawn in 43: the phone column is right-aligned and "Trips so far" left-aligned.
const transportColumns: ColumnDef<TransportCompanyRow>[] = [
  { accessorKey: "name", header: "Transport company", meta: bold },
  { accessorKey: "contactPerson", header: "Contact person" },
  { accessorKey: "phone", header: "Phone", meta: right },
  { accessorKey: "tripsSoFar", header: "Trips so far" },
];

/** 43_15.4_Transport_companies.jpeg, plus the Add and Edit dialogs (no reference) at ?dialog=add and ?dialog=edit&id=. */
export function TransportCompaniesScreen({ rows }: { rows: TransportCompanyRow[] }) {
  return (
    <>
      <SettingsList
        path={TRANSPORT_COMPANIES_PATH}
        rows={rows}
        columns={transportColumns}
        searchText={contactSearch}
        noun="transport companies"
        footnote="Transport companies do not log in."
        action={
          <Button asChild size="header" className={actionClass}>
            <Link href={ADD_TRANSPORT_COMPANY_HREF} scroll={false}>
              + Add transport company
            </Link>
          </Button>
        }
      />
      <Suspense fallback={null}>
        <TransportCompanyDialogs rows={rows} />
      </Suspense>
    </>
  );
}
