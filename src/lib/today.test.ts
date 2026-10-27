import { describe, expect, it } from "vitest";

import { todayInIndia } from "./today";

describe("todayInIndia", () => {
  it("uses India's date, which is ahead of UTC from 18:30 UTC", () => {
    expect(todayInIndia(new Date("2026-10-27T18:29:00Z"))).toBe("2026-10-27");
    expect(todayInIndia(new Date("2026-10-27T18:30:00Z"))).toBe("2026-10-28");
  });
});
