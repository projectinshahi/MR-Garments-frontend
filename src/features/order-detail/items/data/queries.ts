import { itemsByPO } from "./fixtures";

export type OrderItems = NonNullable<Awaited<ReturnType<typeof getOrderItems>>>;
export type ItemRow = OrderItems["lines"][number];

/** Items tab (07): order lines with line totals, sizes and order terms. */
export async function getOrderItems(po: string) {
  const fixture = itemsByPO[po];
  if (!fixture) return undefined;
  const data = structuredClone(fixture);
  const lines = data.lines.map((line) => ({ ...line, lineTotal: line.pieces * line.pricePerPiece }));
  return {
    ...data,
    lines,
    totals: {
      pieces: lines.reduce((sum, l) => sum + l.pieces, 0),
      bundles: lines.reduce((sum, l) => sum + l.bundles, 0),
      value: lines.reduce((sum, l) => sum + l.lineTotal, 0),
    },
    sizeTotal: data.sizes.reduce((sum, s) => sum + s.pieces, 0),
  };
}
