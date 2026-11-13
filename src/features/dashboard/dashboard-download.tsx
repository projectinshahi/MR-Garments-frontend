"use client";

import { ReportDownload } from "@/features/reports/report-actions";
import { todayInIndia } from "@/lib/today";

import { dashboardFile, fetchDashboardSources } from "./dashboard-files";

/** The dashboard's "Download report": loads the four sources again when a format is chosen, every row of each card. */
export function DashboardDownload() {
  return <ReportDownload file={async () => dashboardFile(await fetchDashboardSources(), todayInIndia())} />;
}
