"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import type { ItemRow } from "@/lib/api/types";

import { ItemDialog, ITEMS_PATH } from "./items-dialog";
import { addHref } from "./settings-dialog";
import { actionClass, right, SettingsList } from "./settings-list";
import { perBundleText } from "./settings-logic";

// Fixed widths measured from 46 (table 1134 px), so the "Used in orders" lists don't re-space the columns; a long
// list wraps inside its column. Status and Edit share the rest.
const itemColumns: ColumnDef<ItemRow>[] = [
  { accessorKey: "name", header: "Item", meta: { className: "w-[212px] font-bold" } },
  { accessorKey: "countedIn", header: "Counted in", meta: { className: "w-[167px]" } },
  {
    accessorKey: "perBundle",
    header: "Pieces per bundle",
    meta: { ...right, className: "w-[241px]" },
    cell: ({ row }) => perBundleText(row.original),
  },
  {
    accessorKey: "usedInOrders",
    header: "Used in orders",
    meta: { className: "w-[264px] whitespace-normal" },
    cell: ({ row }) => row.original.usedInOrders.join(", "),
  },
];

/** 46_15.7_Item_list.jpeg, plus the Add and Edit item dialogs at ?dialog=add and ?dialog=edit&id=. */
export function ItemsScreen({ rows }: { rows: ItemRow[] }) {
  return (
    <>
      <SettingsList
        path={ITEMS_PATH}
        rows={rows}
        columns={itemColumns}
        searchText={(row) => [row.name, ...row.usedInOrders]}
        noun="items"
        footnote="Items picked here appear on every new order, so names stay the same everywhere."
        action={
          <Button asChild size="header" className={actionClass}>
            <Link href={addHref(ITEMS_PATH)} scroll={false}>
              + Add item
            </Link>
          </Button>
        }
      />
      <Suspense fallback={null}>
        <ItemDialog rows={rows} />
      </Suspense>
    </>
  );
}
