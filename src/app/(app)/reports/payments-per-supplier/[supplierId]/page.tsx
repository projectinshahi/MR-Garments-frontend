import type { Metadata } from "next";

import { canOpen } from "@/config/navigation";
import { getSupplierPaymentDetail } from "@/features/reports/data/queries";
import { SupplierDetailScreen } from "@/features/reports/supplier-detail-screen";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Supplier payments" };

// Any supplier id, known only at request time: params and searchParams are read inside this route's loading.tsx
// Suspense boundary. An unknown supplier renders the not-found page.
export default async function SupplierPaymentsPage({ params, searchParams }: PageProps<"/reports/payments-per-supplier/[supplierId]">) {
  const [{ supplierId }, search] = await Promise.all([params, searchParams]);
  const [page, me] = await Promise.all([getSupplierPaymentDetail(supplierId, search), getMe()]);
  return <SupplierDetailScreen page={page} linkPos={!!me && canOpen(me, "/orders")} />;
}
