import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrderReportScreen } from "@/features/reports/order-report/order-report-screen";
import { getOrderReport } from "@/features/reports/order-report/queries";
import { todayInIndia } from "@/lib/today";

export const metadata: Metadata = { title: "Order report" };

/**
 * Reports › Order Report › one PO: the comprehensive report (RPT-O1, backend docs/order-report.md) with the Reports
 * breadcrumb, Back to Order Reports and its Excel, PDF and CSV. The order's Report tab renders the same screen inside
 * the order's frame. An unknown PO renders the not-found page.
 */
export default async function DetailedOrderReportPage({ params }: PageProps<"/reports/orders/[po]">) {
  const report = await getOrderReport((await params).po);
  if (!report) notFound();
  return <OrderReportScreen report={report} today={todayInIndia()} frame="reports" />;
}
