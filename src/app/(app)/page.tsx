import type { Metadata } from "next";

import { getDashboard } from "@/features/dashboard/data/queries";
import { DashboardScreen } from "@/features/dashboard/dashboard-screen";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const data = await getDashboard();
  return <DashboardScreen data={data} />;
}
