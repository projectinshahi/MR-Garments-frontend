import { notFound } from "next/navigation";

// Hidden tab: ORD-4 returns no per-order clearing, transport, warehouse, cost or history section yet (the stage screens
// record them per container since wave 3), so the frame doesn't list it and its URL is not found. Reading params
// first keeps notFound() at request time, out of the build.
export default async function ClearingTransportPage({ params }: PageProps<"/orders/[po]/clearing-transport">) {
  await params;
  notFound();
}
