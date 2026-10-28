import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContainerDetailScreen } from "@/features/containers/container-detail-screen";
import { getContainerDetail } from "@/features/containers/data/queries";

export const metadata: Metadata = { title: "Container" };

// Unknown ids are runtime params, read inside the (app) loading.tsx Suspense boundary.
export default async function ContainerPage({ params }: PageProps<"/containers/[id]">) {
  const { id } = await params;
  const data = await getContainerDetail(id);
  if (!data) notFound();
  return <ContainerDetailScreen data={data} />;
}
