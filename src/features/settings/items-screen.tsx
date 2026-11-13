"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import type { ItemRow, UnitRow } from "@/lib/api/types";

import { ItemDialog, itemDeletable, ITEMS_PATH } from "./items-dialog";
import { addHref } from "./settings-dialog";
import { actionClass, right, SettingsList, type SettingsReport, textColumns } from "./settings-list";
import { itemPriceText } from "./settings-logic";

// Fixed widths measured from 46 (table 1134 px), so the "Used in orders" lists don't re-space the columns; a long
// list wraps inside its column. Status and Edit share the rest.
const itemColumns: ColumnDef<ItemRow>[] = [
  { accessorKey: "name", header: "Item", meta: { className: "w-[212px] font-bold" } },
  { accessorKey: "countedIn", header: "Counted in", meta: { className: "w-[167px]" } },
  {
    accessorKey: "price",
    header: "Item price",
    meta: { ...right, className: "w-[241px]" },
    cell: ({ row }) => itemPriceText(row.original.price),
  },
  {
    accessorKey: "usedInOrders",
    header: "Used in orders",
    meta: { className: "w-[264px] whitespace-normal" },
    cell: ({ row }) => row.original.usedInOrders.join(", "),
  },
];

const report: SettingsReport<ItemRow> = {
  title: "Item list",
  slug: "item-list",
  columns: [...textColumns("Item", "Unit (counted in)"), { header: "Item price (master default rate per unit)" }, ...textColumns("Used in orders", "Status")],
  row: (r) => [r.name, r.countedIn, r.price, r.usedInOrders.join(", ") || null, r.status],
  notes: [
    "Item price is the master default rate offered on a new order, in that order's currency. It is not a historical rate: each order keeps the rate saved on its lines (the Orders report's Order Items sheet).",
    "Items have no code or description and are not tied to a supplier in MR Garments, so none is shown.",
  ],
};

/** 46_15.7_Item_list.jpeg, plus the Add and Edit item dialogs at ?dialog=add and ?dialog=edit&id=. */
export function ItemsScreen({ rows, units }: { rows: ItemRow[]; units: UnitRow[] }) {
  return (
    <>
      <SettingsList
        path={ITEMS_PATH}
        rows={rows}
        columns={itemColumns}
        searchText={(row) => [row.name, ...row.usedInOrders]}
        noun="items"
        report={report}
        deletable={itemDeletable}
        footnote="Items picked here appear on every new order, so names stay the same everywhere."
        action={
          <Button asChild size="header" className={actionClass}>
            <Link href={addHref(ITEMS_PATH)} replace scroll={false}>
              + Add item
            </Link>
          </Button>
        }
      />
      <Suspense fallback={null}>
        <ItemDialog rows={rows} units={units} />
      </Suspense>
    </>
  );
}
