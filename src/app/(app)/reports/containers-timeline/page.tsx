import type { Metadata } from "next";

import { getContainersTimelineReport } from "@/features/reports/data/queries";
import { ContainersTimelineScreen } from "@/features/reports/report-screens";

export const metadata: Metadata = { title: "Containers timeline" };

export default async function ContainersTimelinePage({ searchParams }: PageProps<"/reports/containers-timeline">) {
  const page = await getContainersTimelineReport(await searchParams);
  return <ContainersTimelineScreen page={page} />;
}
