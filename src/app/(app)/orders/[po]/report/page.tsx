import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrderReportScreen } from "@/features/reports/order-report/order-report-screen";
import { getOrderReport } from "@/features/reports/order-report/queries";
import { todayInIndia } from "@/lib/today";

export const metadata: Metadata = { title: "Order report" };

/** Order detail, tab f: the per-order report (RPT-O1) with its Excel and PDF. */
export default async function OrderReportPage({ params }: PageProps<"/orders/[po]/report">) {
  const report = await getOrderReport((await params).po);
  if (!report) notFound();
  return <OrderReportScreen report={report} today={todayInIndia()} />;
}
