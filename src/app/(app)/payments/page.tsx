import type { Metadata } from "next";

import { getPayments } from "@/features/payments/data/queries";
import { PaymentsScreen } from "@/features/payments/payments-screen";

export const metadata: Metadata = { title: "Deposits & Payments" };

export default async function PaymentsPage() {
  const data = await getPayments();
  return <PaymentsScreen data={data} />;
}
