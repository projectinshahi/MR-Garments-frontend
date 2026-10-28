import { getSuppliersSettings } from "@/features/settings/data/queries";
import { SuppliersScreen } from "@/features/settings/suppliers-screen";

export default async function SuppliersSettingsPage() {
  return <SuppliersScreen {...await getSuppliersSettings()} />;
}
