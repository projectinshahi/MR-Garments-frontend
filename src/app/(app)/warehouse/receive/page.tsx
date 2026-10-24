import type { Metadata } from "next";

import { getReceiveGoods } from "@/features/warehouse/data/queries";
import { ReceiveGoodsScreen } from "@/features/warehouse/receive-goods-screen";

export const metadata: Metadata = { title: "Receive goods" };

export default async function ReceiveGoodsPage() {
  const data = await getReceiveGoods();
  return <ReceiveGoodsScreen data={data} />;
}
