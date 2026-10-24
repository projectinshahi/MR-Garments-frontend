import { describe, expect, it } from "vitest";

import { getOrderPayments } from "./queries";

describe("getOrderPayments", () => {
  it("converts each payment at its own rate and reproduces the 08 totals", async () => {
    const data = await getOrderPayments("PO-2028");
    expect(data?.payments.map((p) => p.inr)).toEqual([840_000, 140_000]);
    expect(data).toMatchObject({ orderValue: 80_000, paid: 80_000, balance: 0, paidInr: 980_000 });
  });

  it("returns undefined for an order without a payments record", async () => {
    expect(await getOrderPayments("PO-9999")).toBeUndefined();
  });
});
