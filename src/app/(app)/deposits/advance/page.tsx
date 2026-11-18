import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAdvanceOverview } from "@/features/deposits/data/queries";
import { AdvanceOverviewScreen } from "@/features/deposits/advance-screen";

export const metadata: Metadata = { title: "Supplier advance" };

// Supplier-wise: every supplier with its advance per currency. A supplier's own page is /deposits/advance/<id>; the
// older `?supplier=<id>` address goes there. Search params are read inside the shell's Suspense boundary.
export default async function SupplierAdvancePage({ searchParams }: PageProps<"/deposits/advance">) {
  const { supplier } = await searchParams;
  if (typeof supplier === "string" && supplier) redirect(`/deposits/advance/${encodeURIComponent(supplier)}`);
  return <AdvanceOverviewScreen data={await getAdvanceOverview()} />;
}
