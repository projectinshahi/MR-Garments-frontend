import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContainersScreen } from "@/features/order-detail/containers/containers-screen";
import { listOrderContainers } from "@/features/order-detail/containers/data/queries";

export const metadata: Metadata = { title: "Order containers" };

export default async function OrderContainersPage({ params }: PageProps<"/orders/[po]/containers">) {
  const { po } = await params;
  const containers = await listOrderContainers(po);
  if (!containers) notFound();
  return <ContainersScreen po={po} containers={containers} />;
}
