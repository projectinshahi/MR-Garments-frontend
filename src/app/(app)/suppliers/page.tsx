import type { Metadata } from "next";

import { getSuppliersPage } from "@/features/suppliers/data/queries";
import { SuppliersFrame } from "@/features/suppliers/suppliers-frame";
import { SuppliersList } from "@/features/suppliers/suppliers-list";

export const metadata: Metadata = { title: "Suppliers" };

/** Sidebar "Suppliers" (Management): the KPI cards, the tabs and the Supplier List (backend docs/suppliers.md). */
export default async function SuppliersPage() {
  const data = await getSuppliersPage();
  return (
    <SuppliersFrame summary={data.summary} today={data.today}>
      <SuppliersList suppliers={data.suppliers} draft={data.draft} currencies={data.currencies} />
    </SuppliersFrame>
  );
}
