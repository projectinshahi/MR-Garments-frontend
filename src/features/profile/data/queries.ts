import { listUsers } from "@/lib/data/master";

import * as fixtures from "./fixtures";

export type { NotificationPreference } from "./fixtures";

export type ProfileData = Awaited<ReturnType<typeof getProfile>>;
export type ProfileDetails = ProfileData["details"];

/** My profile: the user's details, password date and notification switches. Async and copied so a real API can replace it. */
export async function getProfile() {
  const user = (await listUsers()).find((u) => u.id === fixtures.profileUserId);
  if (!user) throw new Error(`Profile user ${fixtures.profileUserId} is missing from the user master.`);
  return structuredClone({
    details: {
      name: user.name,
      email: user.email,
      phone: fixtures.profileExtras.phone,
      role: user.role,
      office: user.office,
      language: fixtures.profileExtras.language,
    },
    languages: fixtures.languages,
    passwordChangedOn: fixtures.profileExtras.passwordChangedOn,
    notifications: fixtures.notificationPreferences,
  });
}
