import { getLocations } from "@/features/settings/data/queries";
import { OfficesScreen } from "@/features/settings/settings-screens";

export default async function OfficesSettingsPage() {
  return <OfficesScreen rows={await getLocations()} />;
}
