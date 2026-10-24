import type { Metadata } from "next";

import { getDeliveriesPerDayReport } from "@/features/reports/data/queries";
import { DeliveriesPerDayScreen } from "@/features/reports/report-screens";

export const metadata: Metadata = { title: "Deliveries per day" };

export default async function DeliveriesPerDayPage() {
  const data = await getDeliveriesPerDayReport();
  return <DeliveriesPerDayScreen data={data} />;
}
