import { getTransportCompanies } from "@/features/settings/data/queries";
import { TransportCompaniesScreen } from "@/features/settings/transport-companies-screen";

export default async function TransportCompaniesSettingsPage() {
  return <TransportCompaniesScreen rows={await getTransportCompanies()} />;
}
