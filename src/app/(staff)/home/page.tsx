import type { Metadata } from "next";

import { getStaffHome } from "@/features/staff-home/data/queries";
import { StaffHomeScreen } from "@/features/staff-home/staff-home-screen";

export const metadata: Metadata = { title: "Home" };

export default async function StaffHomePage() {
  const data = await getStaffHome();
  return <StaffHomeScreen data={data} />;
}
