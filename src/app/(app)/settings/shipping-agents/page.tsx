import { getShippingAgents } from "@/features/settings/data/queries";
import { ShippingAgentsScreen } from "@/features/settings/settings-screens";

export default async function ShippingAgentsSettingsPage() {
  return <ShippingAgentsScreen rows={await getShippingAgents()} />;
}
