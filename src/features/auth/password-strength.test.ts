import { describe, expect, it } from "vitest";

import { passwordStrength } from "./password-strength";

const met = (password: string) => passwordStrength(password).rules.map((rule) => rule.met);

describe("passwordStrength", () => {
  it("reproduces the reference's state for a 12-character password without a capital: 3 of 4", () => {
    expect(passwordStrength("garments2026").score).toBe(3);
    expect(met("garments2026")).toEqual([true, true, false]);
  });

  it("checks each rule on its own", () => {
    expect(met("")).toEqual([false, false, false]);
    expect(met("abcdefgh")).toEqual([true, false, false]);
    expect(met("abc1")).toEqual([false, true, false]);
    expect(met("Abc")).toEqual([false, false, true]);
  });

  it("adds a point for 12 or more characters", () => {
    expect(passwordStrength("").score).toBe(0);
    expect(passwordStrength("Garments2026").score).toBe(4);
    expect(passwordStrength("Garments202").score).toBe(3);
    expect(passwordStrength("abcdefghijkl").score).toBe(2);
  });
});
