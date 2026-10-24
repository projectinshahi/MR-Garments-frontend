import { getClearingAgents } from "@/features/settings/data/queries";
import { ClearingAgentsScreen } from "@/features/settings/settings-screens";

export default async function ClearingAgentsSettingsPage() {
  return <ClearingAgentsScreen rows={await getClearingAgents()} />;
}
