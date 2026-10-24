import type { Metadata } from "next";

import { getTransportList } from "@/features/transport/data/queries";
import { TransportListScreen } from "@/features/transport/transport-list-screen";

export const metadata: Metadata = { title: "Transport" };

export default async function TransportPage() {
  const data = await getTransportList();
  return <TransportListScreen data={data} />;
}
