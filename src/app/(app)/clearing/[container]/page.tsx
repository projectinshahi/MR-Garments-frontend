import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClearingFormScreen } from "@/features/clearing/clearing-form-screen";
import { getClearingForm } from "@/features/clearing/data/queries";

export const metadata: Metadata = { title: "Clearing (India)" };

// The container id is a runtime param, read inside the (app) loading.tsx Suspense boundary.
export default async function ClearingFormPage({ params }: PageProps<"/clearing/[container]">) {
  const { container } = await params;
  const data = await getClearingForm(container);
  if (!data) notFound();
  // A save changes the saved clearing, so the form starts again from it after router.refresh().
  return <ClearingFormScreen key={`${data.form.clearing?.id}:${data.form.clearing?.status}`} data={data} />;
}
