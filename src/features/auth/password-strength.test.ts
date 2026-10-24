import { describe, expect, it } from "vitest";

import { getChangePassword } from "./data/queries";
import { passwordStrength } from "./password-strength";

const met = (password: string) => passwordStrength(password).rules.map((rule) => rule.met);

describe("passwordStrength", () => {
  it("reproduces the reference with the prefilled new password: 3 of 4, capital letter missing", async () => {
    const { next, confirm } = await getChangePassword();
    expect(next).toHaveLength(12);
    expect(confirm).toBe(next);
    expect(passwordStrength(next).score).toBe(3);
    expect(met(next)).toEqual([true, true, false]);
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
