import { getTeams } from "@/features/settings/data/queries";
import { TeamsScreen } from "@/features/settings/teams-screen";

export default async function TeamsSettingsPage() {
  return <TeamsScreen rows={await getTeams()} />;
}
