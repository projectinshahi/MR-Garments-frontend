import type { Metadata } from "next";

import { AdvanceSupplierScreen } from "@/features/deposits/advance-supplier-screen";
import { getAdvanceSupplier } from "@/features/deposits/data/queries";

export const metadata: Metadata = { title: "Supplier advance" };

// One supplier's advance (any supplier id, known only at request time: params are read inside the shell's Suspense
// boundary). An unknown supplier renders the not-found page.
export default async function SupplierAdvanceDetailPage({ params }: PageProps<"/deposits/advance/[supplierId]">) {
  const { supplierId } = await params;
  return <AdvanceSupplierScreen data={await getAdvanceSupplier(supplierId)} />;
}
