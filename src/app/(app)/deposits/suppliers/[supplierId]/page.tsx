import { redirect } from "next/navigation";

import { ledgerHref } from "@/features/supplier-ledger/ledger-logic";

// A supplier's deposit statement is its supplier ledger now; the deposits are its read-only archive tab (D8, D14).
export default async function SupplierStatementPage({ params }: PageProps<"/deposits/suppliers/[supplierId]">) {
  redirect(ledgerHref((await params).supplierId));
}
