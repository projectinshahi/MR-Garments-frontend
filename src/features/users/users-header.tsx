import { PageHeader } from "@/components/layout/page-header";
import { RouteTabs, type RouteTab } from "@/components/layout/route-tabs";

const TABS: RouteTab[] = [
  { href: "/users", label: "Users", chip: "1" },
  { href: "/users/edit", label: "Add or edit user", chip: "2" },
  { href: "/users/roles", label: "Roles", chip: "3" },
];

/** "Users" header and the 1–3 tab bar shared by the three Users tabs; the actions differ per tab. */
export function UsersHeader({ actions }: { actions?: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Users" actions={actions} />
      <RouteTabs tabs={TABS} label="Users sections" />
    </>
  );
}
