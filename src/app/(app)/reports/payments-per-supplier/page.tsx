import type { Metadata } from "next";

import { getPaymentsPerSupplierReport } from "@/features/reports/data/queries";
import { PaymentsPerSupplierScreen } from "@/features/reports/report-screens";

export const metadata: Metadata = { title: "Payments per supplier" };

export default async function PaymentsPerSupplierPage() {
  const data = await getPaymentsPerSupplierReport();
  return <PaymentsPerSupplierScreen data={data} />;
}
