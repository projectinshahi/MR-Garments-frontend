import type { Metadata } from "next";

import { HistoryArchiveScreen } from "@/features/supplier-history/history-screens";
import { getHistoryArchive } from "@/features/supplier-history/queries";

export const metadata: Metadata = { title: "Supplier legacy archive" };

/** Suppliers › one supplier › Legacy archive: the read-only advance and deposit archives (ADV-1, SD-1). */
export default async function SupplierArchivePage({ params }: PageProps<"/suppliers/[id]/archive">) {
  const { id } = await params;
  return <HistoryArchiveScreen archive={await getHistoryArchive(id)} />;
}
