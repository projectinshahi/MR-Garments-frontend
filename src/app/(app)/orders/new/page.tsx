import type { Metadata } from "next";

import { getNewOrder } from "@/features/order-form/data/queries";
import { NewOrderScreen } from "@/features/order-form/new-order-screen";

export const metadata: Metadata = { title: "New order" };

export default async function NewOrderPage() {
  const data = await getNewOrder();
  return <NewOrderScreen data={data} />;
}
