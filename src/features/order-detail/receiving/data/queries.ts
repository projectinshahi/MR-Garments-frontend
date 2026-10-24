import { receivingByPO } from "./fixtures";

export type OrderReceiving = NonNullable<Awaited<ReturnType<typeof getOrderReceiving>>>;
export type ReceivingRow = OrderReceiving["lines"][number];

/** Receiving tab (09): the receipt in China with short pieces per line. */
export async function getOrderReceiving(po: string) {
  const fixture = receivingByPO[po];
  if (!fixture) return undefined;
  const data = structuredClone(fixture);
  return {
    ...data,
    lines: data.lines.map((line) => ({ ...line, short: line.ordered - line.received })),
    shortPieces: data.ordered.pieces - data.received.pieces,
  };
}
