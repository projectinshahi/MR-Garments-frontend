import type { Metadata } from "next";

import { getLoadContainer } from "@/features/containers/data/queries";
import { LoadContainerScreen } from "@/features/containers/load-container-screen";

export const metadata: Metadata = { title: "Load container" };

export default async function LoadContainerPage() {
  const data = await getLoadContainer();
  return <LoadContainerScreen {...data} />;
}
