import { describe, expect, it } from "vitest";

import { productsByOrder, productsOf, totalsByUnit } from "./order-products";

const line = (orderId: string, position: number, item: string, quantity: number, unit = "pcs") => ({ orderId, position, item, quantity, unit });

describe("order products", () => {
  it("lists every line of each order in line order, never assuming the first line is the order", () => {
    const byOrder = productsByOrder([
      line("o-1", 2, "Polo shirts", 50),
      line("o-2", 0, "Cotton fabric", 300, "m"),
      line("o-1", 0, "Denim jeans", 100),
      line("o-1", 1, "Cotton fabric", 40, "m"),
    ]);
    expect(byOrder.get("o-1")).toEqual([
      { item: "Denim jeans", quantity: 100, unit: "pcs" },
      { item: "Cotton fabric", quantity: 40, unit: "m" },
      { item: "Polo shirts", quantity: 50, unit: "pcs" },
    ]);
    expect(byOrder.get("o-2")).toEqual([{ item: "Cotton fabric", quantity: 300, unit: "m" }]);
    expect(byOrder.get("o-3")).toBeUndefined();
  });

  it("shows an item ordered on two lines once, with both quantities, but keeps different units apart", () => {
    const byOrder = productsByOrder([line("o-1", 0, "Denim jeans", 100), line("o-1", 1, "Denim jeans", 20), line("o-1", 2, "Denim jeans", 5, "m")]);
    expect(byOrder.get("o-1")).toEqual([
      { item: "Denim jeans", quantity: 120, unit: "pcs" },
      { item: "Denim jeans", quantity: 5, unit: "m" },
    ]);
  });

  it("falls back to ORD-1's first line when the order's lines are unknown", () => {
    const first = { item: "Denim jeans", quantity: 100, unit: "pcs" };
    expect(productsOf(first)).toEqual([first]);
    expect(productsOf({ ...first, products: [] })).toEqual([first]);
    expect(productsOf({ ...first, products: [first, { item: "Polo shirts", quantity: 5, unit: "pcs" }] })).toHaveLength(2);
  });

  it("totals the quantity per unit, never adding pieces and metres", () => {
    expect(
      totalsByUnit([
        { item: "Denim jeans", quantity: 100, unit: "pcs" },
        { item: "Cotton fabric", quantity: 40.5, unit: "m" },
        { item: "Polo shirts", quantity: 50, unit: "pcs" },
      ]),
    ).toEqual([
      { unit: "pcs", quantity: 150 },
      { unit: "m", quantity: 40.5 },
    ]);
  });
});
