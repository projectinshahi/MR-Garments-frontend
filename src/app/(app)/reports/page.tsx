import type { Metadata } from "next";

import { getReportsHub } from "@/features/reports/data/queries";
import { ReportsHub } from "@/features/reports/reports-hub";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const data = await getReportsHub();
  return <ReportsHub data={data} />;
}
