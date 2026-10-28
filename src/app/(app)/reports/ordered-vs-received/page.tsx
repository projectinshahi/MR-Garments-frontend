import type { Metadata } from "next";

import { getOrderedVsReceivedReport } from "@/features/reports/data/queries";
import { OrderedVsReceivedScreen } from "@/features/reports/report-screens";

export const metadata: Metadata = { title: "Ordered vs received" };

export default async function OrderedVsReceivedPage({ searchParams }: PageProps<"/reports/ordered-vs-received">) {
  const page = await getOrderedVsReceivedReport(await searchParams);
  return <OrderedVsReceivedScreen page={page} />;
}
