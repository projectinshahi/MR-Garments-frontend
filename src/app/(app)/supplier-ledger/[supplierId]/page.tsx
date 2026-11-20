import type { Metadata } from "next";

import { getSupplierLedger } from "@/features/supplier-ledger/data/queries";
import { SupplierLedgerScreen } from "@/features/supplier-ledger/supplier-ledger-screen";

export const metadata: Metadata = { title: "Supplier ledger" };

// Any supplier id, known only at request time: params are read inside the shell's Suspense boundary. An unknown
// supplier renders the not-found page.
export default async function SupplierLedgerDetailPage({ params }: PageProps<"/supplier-ledger/[supplierId]">) {
  const { supplierId } = await params;
  return <SupplierLedgerScreen data={await getSupplierLedger(supplierId)} />;
}
