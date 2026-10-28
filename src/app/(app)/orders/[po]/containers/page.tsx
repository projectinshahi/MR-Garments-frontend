import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { canOpen } from "@/config/navigation";
import { ContainersScreen } from "@/features/order-detail/containers/containers-screen";
import { getOrderDetail } from "@/features/order-detail/data/queries";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Order containers" };

export default async function OrderContainersPage({ params }: PageProps<"/orders/[po]/containers">) {
  const { po } = await params;
  const [order, me] = await Promise.all([getOrderDetail(po), getMe()]);
  // null: the user can't view containers, so the tab doesn't exist for them.
  if (!order?.containers) notFound();
  return <ContainersScreen order={order} containers={order.containers} linkContainers={!!me && canOpen(me, "/containers")} />;
}
