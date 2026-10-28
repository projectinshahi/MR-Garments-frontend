"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { ItemRow } from "@/lib/api/types";

import { PrototypeAction, right, SettingsList } from "./settings-list";
import { perBundleText } from "./settings-logic";

// Fixed widths measured from 46 (table 1134 px), so the empty "Used in orders" (B6) doesn't re-space the columns.
// Status and Edit share the rest.
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
    meta: { className: "w-[264px]" },
    cell: ({ row }) => row.original.usedInOrders.join(", "),
  },
];

/** 46_15.7_Item_list.jpeg */
export function ItemsScreen({ rows }: { rows: ItemRow[] }) {
  return (
    <SettingsList
      path="/settings/items"
      rows={rows}
      columns={itemColumns}
      searchText={(row) => [row.name, ...row.usedInOrders]}
      noun="items"
      footnote="Items picked here appear on every new order, so names stay the same everywhere."
      action={<PrototypeAction label="Add item" />}
    />
  );
}
