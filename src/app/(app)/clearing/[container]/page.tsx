import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClearingFormScreen } from "@/features/clearing/clearing-form-screen";
import { getClearingForm, listClearingFormSlugs } from "@/features/clearing/data/queries";

export const metadata: Metadata = { title: "Clearing (India)" };

/** The container segment is the number with its space as a hyphen: /clearing/CAIU-2298076. */
export async function generateStaticParams() {
  return (await listClearingFormSlugs()).map((container) => ({ container }));
}

export default async function ClearingFormPage({ params }: PageProps<"/clearing/[container]">) {
  const { container } = await params;
  const data = await getClearingForm(container);
  if (!data) notFound();
  return <ClearingFormScreen data={data} />;
}
