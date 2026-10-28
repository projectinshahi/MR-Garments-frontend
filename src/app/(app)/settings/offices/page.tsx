import { getLocations } from "@/features/settings/data/queries";
import { OfficesScreen } from "@/features/settings/offices-screen";

export default async function OfficesSettingsPage() {
  return <OfficesScreen rows={await getLocations()} />;
}
