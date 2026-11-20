import { redirect } from "next/navigation";

import { ledgerHref } from "@/features/supplier-ledger/ledger-logic";

// A supplier's advance page is its supplier ledger now (D14).
export default async function SupplierAdvanceDetailPage({ params }: PageProps<"/deposits/advance/[supplierId]">) {
  redirect(ledgerHref((await params).supplierId));
}
