import { redirect } from "next/navigation";

import { ledgerHref } from "@/features/supplier-ledger/ledger-logic";

// The supplier advance became supplier payments on the unified ledger (D14). The older `?supplier=<id>` address goes to
// that supplier's ledger. Search params are read inside the shell's Suspense boundary.
export default async function SupplierAdvancePage({ searchParams }: PageProps<"/deposits/advance">) {
  const { supplier } = await searchParams;
  redirect(typeof supplier === "string" && supplier ? ledgerHref(supplier) : "/supplier-ledger");
}
