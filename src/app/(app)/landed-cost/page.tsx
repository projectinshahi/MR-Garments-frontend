import type { Metadata } from "next";

import { getLandedCost } from "@/features/landed-cost/data/queries";
import { LandedCostScreen } from "@/features/landed-cost/landed-cost-screen";

export const metadata: Metadata = { title: "Landed Cost" };

export default async function LandedCostPage() {
  const data = await getLandedCost();
  return <LandedCostScreen data={data} />;
}
