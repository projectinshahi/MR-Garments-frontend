import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClearingTransportScreen } from "@/features/order-detail/clearing-transport/clearing-transport-screen";
import { getClearingTransport } from "@/features/order-detail/clearing-transport/data/queries";

export const metadata: Metadata = { title: "Clearing & transport" };

export default async function ClearingTransportPage({ params }: PageProps<"/orders/[po]/clearing-transport">) {
  const { po } = await params;
  const data = await getClearingTransport(po);
  if (!data) notFound();
  return <ClearingTransportScreen po={po} data={data} />;
}
