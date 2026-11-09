import type { Metadata } from "next";

import { getStatement } from "@/features/deposits/data/queries";
import { StatementScreen } from "@/features/deposits/statement-screen";

export const metadata: Metadata = { title: "Supplier deposits" };

// Any supplier id, known only at request time: params are read inside the shell's Suspense boundary. An unknown
// supplier renders the not-found page.
export default async function SupplierDepositsPage({ params }: PageProps<"/deposits/suppliers/[supplierId]">) {
  const { supplierId } = await params;
  return <StatementScreen data={await getStatement(supplierId)} />;
}
