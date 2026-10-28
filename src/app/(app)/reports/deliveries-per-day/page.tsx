import type { Metadata } from "next";

import { getDeliveriesPerDayReport } from "@/features/reports/data/queries";
import { DeliveriesPerDayScreen } from "@/features/reports/report-screens";

export const metadata: Metadata = { title: "Deliveries per day" };

export default async function DeliveriesPerDayPage({ searchParams }: PageProps<"/reports/deliveries-per-day">) {
  const page = await getDeliveriesPerDayReport(await searchParams);
  return <DeliveriesPerDayScreen page={page} />;
}
