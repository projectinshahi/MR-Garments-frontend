import type { Metadata } from "next";

import { ContainersListScreen } from "@/features/containers/containers-list-screen";
import { getContainersList } from "@/features/containers/data/queries";

export const metadata: Metadata = { title: "Containers" };

export default async function ContainersPage() {
  const data = await getContainersList();
  return <ContainersListScreen data={data} />;
}
