import { describe, expect, it } from "vitest";

import { getOrderItems } from "@/features/order-detail/items/data/queries";
import { getOrderReceiving } from "@/features/order-detail/receiving/data/queries";

import { getOrderOverview } from "./queries";

// Derived figures must reproduce the screenshots exactly (06, 07, 09).
describe("order-detail derived figures", () => {
  it("overview: landed cost, cost per piece and team total", async () => {
    expect(await getOrderOverview("PO-2028")).toMatchObject({ landedCost: 1_377_000, costPerPiece: 550.8, teamTotal: 2500 });
  });

  it("items: line totals and size total", async () => {
    const data = await getOrderItems("PO-2028");
    expect(data?.totals).toEqual({ pieces: 2500, bundles: 50, value: 80_000 });
    expect(data?.sizeTotal).toBe(2500);
  });

  it("receiving: no short pieces", async () => {
    const data = await getOrderReceiving("PO-2028");
    expect(data?.shortPieces).toBe(0);
    expect(data?.lines[0]?.short).toBe(0);
  });
});
