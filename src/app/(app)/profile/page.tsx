import type { Metadata } from "next";

import { getProfile } from "@/features/profile/data/queries";
import { ProfileScreen } from "@/features/profile/profile-screen";

export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage() {
  const { profile, options } = await getProfile();
  return <ProfileScreen profile={profile} languages={options.languages} />;
}
