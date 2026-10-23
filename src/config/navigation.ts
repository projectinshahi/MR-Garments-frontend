// Sidebar navigation as shown in the references (orchestrator-owned).
// D6: ADMIN is always visible to Management. The staff variant (39) is the one role-specific exception.

export type NavItem = { title: string; href: string };
export type NavSection = { label?: string; items: NavItem[] };

export const MANAGEMENT_NAV: NavSection[] = [
  {
    items: [
      { title: "Dashboard", href: "/" },
      { title: "Orders", href: "/orders" },
      { title: "Deposits & Payments", href: "/payments" },
      { title: "Delivery Calendar", href: "/calendar" },
    ],
  },
  {
    label: "Stages",
    items: [
      { title: "Receiving (China)", href: "/receiving" },
      { title: "Containers", href: "/containers" },
      { title: "Clearing (India)", href: "/clearing" },
      { title: "Transport", href: "/transport" },
      { title: "Warehouse", href: "/warehouse" },
    ],
  },
  {
    label: "Management",
    items: [
      { title: "Landed Cost", href: "/landed-cost" },
      { title: "Reports", href: "/reports" },
    ],
  },
  {
    label: "Admin",
    items: [
      { title: "Settings", href: "/settings" },
      { title: "Users", href: "/users" },
    ],
  },
];

export const STAFF_NAV: NavSection[] = [
  { items: [{ title: "Home", href: "/home" }] },
  { label: "Your stage", items: [{ title: "Receiving (China)", href: "/receiving" }] },
];

/** B3: the sidebar user block opens this menu. It is the only interaction not shown in the references. */
export const USER_MENU: NavItem[] = [
  { title: "My profile", href: "/profile" },
  { title: "Notifications", href: "/notifications" },
  { title: "Sign out", href: "/login" },
];

export const isActivePath = (pathname: string | null, href: string) =>
  pathname === href || (href !== "/" && !!pathname?.startsWith(`${href}/`));
