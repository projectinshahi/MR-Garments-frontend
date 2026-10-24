import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { LoadingState } from "@/components/shared/states";
import { getTransportForm, listTransportFormSlugs } from "@/features/transport/data/queries";
import { TransportFormScreen } from "@/features/transport/transport-form-screen";

export const metadata: Metadata = { title: "Transport" };

type Params = PageProps<"/transport/[container]">["params"];

// cacheComponents: the designed containers are known at build time ("CAIU-2298076").
export async function generateStaticParams() {
  return (await listTransportFormSlugs()).map((container) => ({ container }));
}

// The container read stays behind Suspense, so the route's shared App Shell never depends on one URL.
export default function TransportFormPage({ params }: PageProps<"/transport/[container]">) {
  return (
    <Suspense fallback={<LoadingState />}>
      <TransportForm params={params} />
    </Suspense>
  );
}

async function TransportForm({ params }: { params: Params }) {
  const { container } = await params;
  const data = await getTransportForm(container);
  if (!data) notFound();
  return <TransportFormScreen data={data} />;
}
