import { describe, expect, it } from "vitest";

import { dueLabel, waitingSummary } from "./staff-home-logic";

describe("dueLabel", () => {
  it("adds the late marker to late orders", () => {
    expect(dueLabel({ due: "2026-09-26", late: true })).toBe("26 Sep · late");
  });

  it("shows only the short date for orders not yet late", () => {
    expect(dueLabel({ due: "2026-10-01", late: false })).toBe("1 Oct");
  });
});

describe("waitingSummary", () => {
  it("reproduces the banner sub-line for five orders", () => {
    expect(waitingSummary(5)).toBe("5 orders are waiting for you to record what was received in China.");
  });

  it("uses the singular for one order", () => {
    expect(waitingSummary(1)).toBe("1 order is waiting for you to record what was received in China.");
  });
});
