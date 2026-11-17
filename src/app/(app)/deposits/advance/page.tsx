import type { Metadata } from "next";

import { getAdvance } from "@/features/deposits/data/queries";
import { AdvanceScreen } from "@/features/deposits/advance-screen";

export const metadata: Metadata = { title: "Supplier advance" };

// `?supplier=<id>` picks the account (read inside the shell's Suspense boundary, as the other Deposits pages are).
export default async function SupplierAdvancePage({ searchParams }: PageProps<"/deposits/advance">) {
  const { supplier } = await searchParams;
  return <AdvanceScreen data={await getAdvance(typeof supplier === "string" && supplier ? supplier : null)} />;
}
