import type { Metadata } from "next";

import { getPaymentsPerSupplierReport } from "@/features/reports/data/queries";
import { PaymentsPerSupplierScreen } from "@/features/reports/report-screens";

export const metadata: Metadata = { title: "Payments per supplier" };

export default async function PaymentsPerSupplierPage({ searchParams }: PageProps<"/reports/payments-per-supplier">) {
  const page = await getPaymentsPerSupplierReport(await searchParams);
  return <PaymentsPerSupplierScreen page={page} />;
}
