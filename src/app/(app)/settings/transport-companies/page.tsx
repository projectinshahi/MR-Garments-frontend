import { getTransportCompanies } from "@/features/settings/data/queries";
import { TransportCompaniesScreen } from "@/features/settings/settings-screens";

export default async function TransportCompaniesSettingsPage() {
  return <TransportCompaniesScreen rows={await getTransportCompanies()} />;
}
