"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import type { SupplierRow } from "@/lib/api/types";

import { ADD_SUPPLIER_HREF, AddSupplierDialog } from "./add-supplier-dialog";
import { actionClass, bold, contactSearch, right, SettingsList } from "./settings-list";
import type { SupplierDraft } from "./settings-logic";

const CURRENCY_SYMBOL: Record<SupplierRow["currency"], string> = { CNY: "¥" };

const supplierColumns: ColumnDef<SupplierRow>[] = [
  { accessorKey: "name", header: "Supplier", meta: bold },
  { accessorKey: "contactPerson", header: "Contact person" },
  { accessorKey: "phone", header: "Phone / WeChat" },
  { accessorKey: "city", header: "City" },
  { accessorKey: "currency", header: "Currency", cell: ({ row }) => CURRENCY_SYMBOL[row.original.currency] },
  { accessorKey: "openOrders", header: "Open orders", meta: right },
];

/** 40_15.1_Suppliers.jpeg, plus the Add supplier dialog (53_17.4) at ?dialog=add. */
export function SuppliersScreen({ suppliers, draft }: { suppliers: SupplierRow[]; draft: SupplierDraft }) {
  return (
    <>
      <SettingsList
        path="/settings/suppliers"
        rows={suppliers}
        columns={supplierColumns}
        searchText={contactSearch}
        noun="suppliers"
        footnote="Suppliers appear in the dropdown when a new order is created."
        action={
          <Button asChild size="header" className={actionClass}>
            <Link href={ADD_SUPPLIER_HREF} scroll={false}>
              + Add supplier
            </Link>
          </Button>
        }
      />
      <Suspense fallback={null}>
        <AddSupplierDialog draft={draft} />
      </Suspense>
    </>
  );
}
