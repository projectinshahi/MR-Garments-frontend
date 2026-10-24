import { describe, expect, it } from "vitest";

import { getProfile } from "./queries";

describe("getProfile", () => {
  it("reproduces the reference details from the user master plus the profile fields", async () => {
    const profile = await getProfile();
    expect(profile.details).toEqual({
      name: "Suresh Menon",
      email: "suresh@mrgarments.com",
      phone: "+91 98470 20011",
      role: "Management",
      office: "Head office",
      language: "English",
    });
    expect(profile.passwordChangedOn).toBe("2026-08-12");
    expect(profile.notifications.map((n) => [n.title, n.enabled])).toEqual([
      ["Delivery reminders", true],
      ["Late deliveries", true],
      ["Payments due", true],
      ["Short receipts", false],
    ]);
  });

  it("returns a copy, so client state cannot change the fixtures", async () => {
    const first = await getProfile();
    first.notifications[3].enabled = true;
    expect((await getProfile()).notifications[3].enabled).toBe(false);
  });
});
