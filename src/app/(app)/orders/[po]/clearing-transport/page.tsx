import { notFound } from "next/navigation";

// Hidden tab: nothing records clearing, transport, warehouse, cost or an order history yet, so the frame doesn't
// list it and its URL is not found. Reading params first keeps notFound() at request time, out of the build.
export default async function ClearingTransportPage({ params }: PageProps<"/orders/[po]/clearing-transport">) {
  await params;
  notFound();
}
