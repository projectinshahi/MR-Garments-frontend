import { getItems } from "@/features/settings/data/queries";
import { ItemsScreen } from "@/features/settings/items-screen";

export default async function ItemsSettingsPage() {
  return <ItemsScreen rows={await getItems()} />;
}
