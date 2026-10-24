"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Suspense, useState } from "react";

import { notInPrototype } from "@/components/shared/prototype";
import { Button } from "@/components/ui/button";
import { formatINR, formatNumber } from "@/lib/formatters";
import type {
  ClearingAgent,
  Currency,
  ItemMaster,
  Location,
  ShippingAgent,
  Supplier,
  Team,
  TransportCompany,
} from "@/types/domain";

import { ADD_SUPPLIER_HREF, AddSupplierDialog } from "./add-supplier-dialog";
import { SettingsList } from "./settings-list";
import { addSupplier, type SupplierDraft } from "./settings-logic";

// One screen per Settings tab (40–46). Columns, alignment and footnotes follow each reference.

const bold = { className: "font-bold" };
const right = { align: "right" } as const;
const CURRENCY_SYMBOL: Record<Currency, string> = { CNY: "¥", INR: "₹" };
// Header primary action: 34 px tall, 15 px side padding inside the border in every Settings reference.
const actionClass = "px-[15px]";

function PrototypeAction({ label }: { label: string }) {
  return (
    <Button type="button" size="header" className={actionClass} onClick={() => notInPrototype(label)}>
      + {label}
    </Button>
  );
}

const contactSearch = (row: { name: string; contactPerson: string; phone: string }) => [row.name, row.contactPerson, row.phone];

const supplierColumns: ColumnDef<Supplier>[] = [
  { accessorKey: "name", header: "Supplier", meta: bold },
  { accessorKey: "contactPerson", header: "Contact person" },
  { accessorKey: "phone", header: "Phone / WeChat" },
  { accessorKey: "city", header: "City" },
  { accessorKey: "currency", header: "Currency", cell: ({ row }) => CURRENCY_SYMBOL[row.original.currency] },
  { accessorKey: "openOrders", header: "Open orders", meta: right },
];

/** 40_15.1_Suppliers.jpeg, plus the Add supplier dialog (53_17.4) at ?dialog=add-supplier. */
export function SuppliersScreen({ suppliers, draft }: { suppliers: Supplier[]; draft: SupplierDraft }) {
  // Mock mutation: client state only, resets on reload
  const [rows, setRows] = useState(suppliers);
  return (
    <>
      <SettingsList
        rows={rows}
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
        <AddSupplierDialog draft={draft} onSave={(supplier) => setRows((current) => addSupplier(current, supplier))} />
      </Suspense>
    </>
  );
}

const shippingColumns: ColumnDef<ShippingAgent>[] = [
  { accessorKey: "name", header: "Shipping agent", meta: bold },
  { accessorKey: "contactPerson", header: "Contact person" },
  { accessorKey: "phone", header: "Phone" },
  { accessorKey: "officeCity", header: "Office city" },
  { accessorKey: "activeContainers", header: "Active containers", meta: right },
];

/** 41_15.2_Shipping_agents.jpeg */
export function ShippingAgentsScreen({ rows }: { rows: ShippingAgent[] }) {
  return (
    <SettingsList
      rows={rows}
      columns={shippingColumns}
      searchText={contactSearch}
      noun="shipping agents"
      footnote="The shipping agent looks after the container from China to the Indian port. The agent does not log in."
      action={<PrototypeAction label="Add shipping agent" />}
    />
  );
}

const clearingColumns: ColumnDef<ClearingAgent>[] = [
  { accessorKey: "name", header: "Clearing agent", meta: bold },
  { accessorKey: "contactPerson", header: "Contact person" },
  { accessorKey: "phone", header: "Phone" },
  { accessorKey: "port", header: "Port" },
  { accessorKey: "containersCleared", header: "Containers cleared", meta: right },
];

/** 42_15.3_Clearing_agents.jpeg */
export function ClearingAgentsScreen({ rows }: { rows: ClearingAgent[] }) {
  return (
    <SettingsList
      rows={rows}
      columns={clearingColumns}
      searchText={contactSearch}
      noun="clearing agents"
      footnote="Clearing agents do not log in. Staff enter their figures from the agent’s papers."
      action={<PrototypeAction label="Add clearing agent" />}
    />
  );
}

// As drawn in 43: the phone column is right-aligned and "Trips so far" left-aligned.
const transportColumns: ColumnDef<TransportCompany>[] = [
  { accessorKey: "name", header: "Transport company", meta: bold },
  { accessorKey: "contactPerson", header: "Contact person" },
  { accessorKey: "phone", header: "Phone", meta: right },
  { accessorKey: "tripsSoFar", header: "Trips so far" },
];

/** 43_15.4_Transport_companies.jpeg */
export function TransportCompaniesScreen({ rows }: { rows: TransportCompany[] }) {
  return (
    <SettingsList
      rows={rows}
      columns={transportColumns}
      searchText={contactSearch}
      noun="transport companies"
      footnote="Transport companies do not log in."
      action={<PrototypeAction label="Add transport company" />}
    />
  );
}

const locationColumns: ColumnDef<Location>[] = [
  { accessorKey: "name", header: "Name", meta: bold },
  { accessorKey: "type", header: "Type" },
  { accessorKey: "country", header: "Country" },
  { accessorKey: "address", header: "Address" },
  { accessorKey: "staff", header: "Staff", cell: ({ row }) => row.original.staff.join(", ") },
];

/** 44_15.5_Offices_&_warehouses.jpeg */
export function OfficesScreen({ rows }: { rows: Location[] }) {
  return (
    <SettingsList
      rows={rows}
      columns={locationColumns}
      searchText={(row) => [row.name, row.address, ...row.staff]}
      noun="offices or warehouses"
      footnote="Offices are used in Receiving (China). Warehouses are used when goods are received in India."
      action={<PrototypeAction label="Add office or warehouse" />}
    />
  );
}

const teamColumns: ColumnDef<Team>[] = [
  { accessorKey: "name", header: "Team", meta: bold },
  { accessorKey: "piecesInStock", header: "Pieces in stock", meta: right, cell: ({ row }) => formatNumber(row.original.piecesInStock) },
  {
    accessorKey: "landedCostOfStock",
    header: "Landed cost of stock",
    meta: right,
    cell: ({ row }) => formatINR(row.original.landedCostOfStock),
  },
  {
    accessorKey: "averagePerPiece",
    header: "Average per piece",
    meta: right,
    cell: ({ row }) => formatINR(row.original.averagePerPiece, 2),
  },
];

/** 45_15.6_Teams.jpeg */
export function TeamsScreen({ rows }: { rows: Team[] }) {
  return (
    <SettingsList
      rows={rows}
      columns={teamColumns}
      searchText={(row) => [row.name]}
      noun="teams"
      footnote="Goods are split between these teams when they are received in the warehouse. Team names here are examples."
      action={<PrototypeAction label="Add team" />}
    />
  );
}

const itemColumns: ColumnDef<ItemMaster>[] = [
  { accessorKey: "name", header: "Item", meta: bold },
  { accessorKey: "countedIn", header: "Counted in" },
  {
    accessorKey: "perBundle",
    header: "Pieces per bundle",
    meta: right,
    cell: ({ row }) => (typeof row.original.perBundle === "number" ? formatNumber(row.original.perBundle) : row.original.perBundle),
  },
  { accessorKey: "usedInOrders", header: "Used in orders", cell: ({ row }) => row.original.usedInOrders.join(", ") },
];

/** 46_15.7_Item_list.jpeg */
export function ItemsScreen({ rows }: { rows: ItemMaster[] }) {
  return (
    <SettingsList
      rows={rows}
      columns={itemColumns}
      searchText={(row) => [row.name, ...row.usedInOrders]}
      noun="items"
      footnote="Items picked here appear on every new order, so names stay the same everywhere."
      action={<PrototypeAction label="Add item" />}
    />
  );
}
