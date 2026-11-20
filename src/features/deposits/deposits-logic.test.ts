import { describe, expect, it } from "vitest";

import type { SupplierStatement } from "@/lib/api/deposits-types";

import { amountList, amountText, statementTotals } from "./deposits-logic";

// The supplier-deposit archive helpers (SD-1, read-only since the unified supplier ledger).

describe("statementTotals", () => {
  it("turns SD-1's summary lines into one direction's three figures per currency, CNY first", () => {
    const summary: SupplierStatement["summary"] = [
      { currency: "USD", direction: "give", amount: 200, settled: 0, pending: 200 },
      { currency: "CNY", direction: "give", amount: 1000, settled: 300, pending: 700 },
      { currency: "CNY", direction: "receive", amount: 500, settled: 100, pending: 400 },
    ];
    expect(statementTotals(summary, "give")).toEqual({
      amount: [
        { currency: "CNY", amount: 1000 },
        { currency: "USD", amount: 200 },
      ],
      paid: [
        { currency: "CNY", amount: 300 },
        { currency: "USD", amount: 0 },
      ],
      pending: [
        { currency: "CNY", amount: 700 },
        { currency: "USD", amount: 200 },
      ],
    });
    expect(statementTotals(summary, "receive").amount).toEqual([{ currency: "CNY", amount: 500 }]);
    expect(statementTotals([], "receive")).toEqual({ amount: [], paid: [], pending: [] });
  });
});

describe("money text", () => {
  it("shows paise only when there are some, on single amounts and on per-currency lists", () => {
    expect(amountText(1234.5, "CNY")).toBe("¥1,234.50");
    expect(amountText(1000, "USD")).toBe("$1,000");
    expect(amountText(0.01, "INR")).toBe("₹0.01");
    expect(
      amountList([
        { currency: "CNY", amount: 1234.5 },
        { currency: "USD", amount: 0 },
        { currency: "INR", amount: 20 },
      ]),
    ).toBe("¥1,234.50 · ₹20");
    expect(amountList([{ currency: "USD", amount: 0 }])).toBe("$0");
    expect(amountList([])).toBe("¥0");
    expect(amountList([], "INR")).toBe("₹0");
  });
});
