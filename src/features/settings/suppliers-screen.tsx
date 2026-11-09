"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { statementHref } from "@/features/deposits/deposits-logic";
import { rowActionClass } from "@/features/orders/delete-order";
import type { SupplierRow } from "@/lib/api/types";
import { CURRENCY_SYMBOL } from "@/lib/formatters";

import { ADD_SUPPLIER_HREF, supplierDeletable, SupplierDialog } from "./add-supplier-dialog";
import { actionClass, bold, contactSearch, right, SettingsList } from "./settings-list";
import type { SupplierDraft } from "./settings-logic";

const supplierColumns: ColumnDef<SupplierRow>[] = [
  { accessorKey: "name", header: "Supplier", meta: bold },
  { accessorKey: "contactPerson", header: "Contact person" },
  { accessorKey: "phone", header: "Phone / WeChat" },
  { accessorKey: "city", header: "City" },
  { accessorKey: "currency", header: "Currency", cell: ({ row }) => CURRENCY_SYMBOL[row.original.currency] },
  { accessorKey: "openOrders", header: "Open orders", meta: right },
  {
    id: "deposits",
    header: () => <span className="sr-only">Deposits</span>,
    meta: { className: "w-px whitespace-nowrap" },
    // The supplier's deposit statement (docs/phase2-contracts.md 3.3), as a text link like Edit.
    cell: ({ row }) => (
      <Link href={statementHref(row.original.id)} aria-label={`Deposits of ${row.original.name}`} className={rowActionClass}>
        Deposits
      </Link>
    ),
  },
];

/** 40_15.1_Suppliers.jpeg, plus the Add supplier dialog (53_17.4) at ?dialog=add and Edit supplier at ?dialog=edit&id=. */
export function SuppliersScreen({ suppliers, draft }: { suppliers: SupplierRow[]; draft: SupplierDraft }) {
  return (
    <>
      <SettingsList
        path="/settings/suppliers"
        rows={suppliers}
        columns={supplierColumns}
        searchText={contactSearch}
        noun="suppliers"
        deletable={supplierDeletable}
        footnote="Suppliers appear in the dropdown when a new order is created."
        action={
          <Button asChild size="header" className={actionClass}>
            <Link href={ADD_SUPPLIER_HREF} replace scroll={false}>
              + Add supplier
            </Link>
          </Button>
        }
      />
      <Suspense fallback={null}>
        <SupplierDialog draft={draft} suppliers={suppliers} />
      </Suspense>
    </>
  );
}
