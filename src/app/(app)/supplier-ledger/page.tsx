import type { Metadata } from "next";

import { getLedgerOverview } from "@/features/supplier-ledger/data/queries";
import { LedgerOverviewScreen } from "@/features/supplier-ledger/ledger-overview-screen";

export const metadata: Metadata = { title: "Supplier ledger" };

export default async function SupplierLedgerPage() {
  return <LedgerOverviewScreen data={await getLedgerOverview()} />;
}
