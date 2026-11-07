import { getUnits } from "@/features/settings/data/queries";
import { UnitsScreen } from "@/features/settings/units-screen";

export default async function UnitsSettingsPage() {
  return <UnitsScreen rows={await getUnits()} />;
}
