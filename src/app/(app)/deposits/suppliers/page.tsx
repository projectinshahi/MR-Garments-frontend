import type { Metadata } from "next";

import { getDeposits } from "@/features/deposits/data/queries";
import { DepositsScreen } from "@/features/deposits/deposits-screen";

export const metadata: Metadata = { title: "Deposits by supplier" };

export default async function DepositSuppliersPage() {
  return <DepositsScreen data={await getDeposits()} view="suppliers" />;
}
