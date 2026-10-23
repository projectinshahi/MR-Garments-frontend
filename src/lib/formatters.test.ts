import { describe, expect, it } from "vitest";

import {
  formatCNY,
  formatDate,
  formatDateTime,
  formatINR,
  formatLakh,
  formatQty,
  formatRate,
  formatRelativeDateTime,
  formatShortDate,
  formatToday,
} from "@/lib/formatters";

// Expected strings are copied from the reference screenshots.
describe("money", () => {
  it("formats INR with Indian grouping", () => {
    expect(formatINR(1377000)).toBe("₹13,77,000");
    expect(formatINR(550.8, 2)).toBe("₹550.80");
    expect(formatINR(0)).toBe("₹0");
  });

  it("formats CNY, optionally spaced and negative", () => {
    expect(formatCNY(80000)).toBe("¥80,000");
    expect(formatCNY(141000)).toBe("¥1,41,000");
    expect(formatCNY(62780, { spaced: true })).toBe("¥ 62,780");
    expect(formatCNY(32, { decimals: 2 })).toBe("¥32.00");
    expect(formatCNY(-2400, { spaced: true })).toBe("−¥ 2,400");
  });

  it("formats lakh, rates and quantities", () => {
    expect(formatLakh(4260000)).toBe("₹42.6 L");
    expect(formatRate(12)).toBe("12.00");
    expect(formatQty(2400, "m")).toBe("2,400 m");
    expect(formatQty(40000, "pcs")).toBe("40,000 pcs");
  });
});

describe("dates", () => {
  it("formats absolute dates", () => {
    expect(formatDate("2026-08-05")).toBe("5 Aug 2026");
    expect(formatShortDate("2026-09-26")).toBe("26 Sep");
    expect(formatDateTime("2026-10-03T16:10")).toBe("3 Oct 2026, 16:10");
  });

  it("formats relative to the mock clock (30 Sep 2026)", () => {
    expect(formatRelativeDateTime("2026-09-30T09:12")).toBe("Today, 09:12");
    expect(formatRelativeDateTime("2026-09-29T17:05")).toBe("Yesterday, 17:05");
    expect(formatRelativeDateTime("2026-09-26T14:02")).toBe("26 Sep, 14:02");
    expect(formatToday()).toBe("Today, 30 Sep 2026");
    expect(formatToday("weekday")).toBe("Wed, 30 Sep 2026");
  });
});
