import type { Metadata } from "next";

import { getLandedCost } from "@/features/landed-cost/data/queries";
import { LandedCostScreen } from "@/features/landed-cost/landed-cost-screen";

export const metadata: Metadata = { title: "Landed Cost" };

export default async function LandedCostPage({ searchParams }: PageProps<"/landed-cost">) {
  const data = await getLandedCost(await searchParams);
  return <LandedCostScreen data={data} />;
}
