import type { Metadata } from "next";

import { getLandedCostByMonthReport } from "@/features/reports/data/queries";
import { LandedCostByMonthScreen } from "@/features/reports/report-screens";

export const metadata: Metadata = { title: "Landed cost by month" };

export default async function LandedCostByMonthPage() {
  const data = await getLandedCostByMonthReport();
  return <LandedCostByMonthScreen data={data} />;
}
