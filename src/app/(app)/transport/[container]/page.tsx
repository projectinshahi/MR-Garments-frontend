import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getTransportForm } from "@/features/transport/data/queries";
import { TransportFormScreen } from "@/features/transport/transport-form-screen";

export const metadata: Metadata = { title: "Transport" };

// The container id is a runtime param, read inside the (app) loading.tsx Suspense boundary.
export default async function TransportFormPage({ params }: PageProps<"/transport/[container]">) {
  const { container } = await params;
  const data = await getTransportForm(container);
  if (!data) notFound();
  // A save changes the saved trip, so the form starts again from it after router.refresh().
  return <TransportFormScreen key={`${data.form.trip?.id}:${data.form.trip?.status}`} data={data} />;
}
