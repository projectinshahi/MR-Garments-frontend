import { getItems, getUnits } from "@/features/settings/data/queries";
import { ItemsScreen } from "@/features/settings/items-screen";

export default async function ItemsSettingsPage() {
  const [rows, units] = await Promise.all([getItems(), getUnits()]);
  return <ItemsScreen rows={rows} units={units} />;
}
