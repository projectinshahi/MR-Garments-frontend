// Sidebar navigation and page access (orchestrator-owned).
// D6: ADMIN is always visible to Management. Batch 1 (B3, N-b): every other role sees only what its permissions allow,
// and staff see "Your stage" listing the stages they are granted. The proxy uses the same rules (P-b).

import type { Access, Capability, Me } from "@/lib/api/types";

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

/** B3: the sidebar user block opens this menu. "Sign out" is a separate action (AUTH-2). */
export const USER_MENU: NavItem[] = [
  { title: "My profile", href: "/profile" },
  { title: "Notifications", href: "/notifications" },
];

export const isActivePath = (pathname: string | null, href: string) =>
  pathname === href || (href !== "/" && !!pathname?.startsWith(`${href}/`));

/** The session cookie set by the API (B9.7). */
export const SESSION_COOKIE = "mrg.sid";

/** Where a page or request goes when the session has ended (E6, E7); the sign-in page shows M4. */
export const SESSION_ENDED_URL = "/login?reason=session-ended";

/** Pages anyone can open, signed in or not. There is no self-service password page: Management sets passwords. */
export const PUBLIC_PATHS = ["/login"];

/** Pages every signed-in user can open. */
const SIGNED_IN_PATHS = ["/profile", "/notifications"];

/** The capability a page needs (View or better), by route prefix. Longest prefix wins. */
const ROUTE_CAPABILITY: [string, Capability][] = [
  ["/orders", "ordersView"],
  ["/payments", "payments"],
  ["/calendar", "calendar"],
  ["/receiving", "receiving"],
  ["/containers", "containers"],
  ["/clearing", "clearing"],
  ["/transport", "transport"],
  ["/warehouse", "warehouse"],
  ["/landed-cost", "landedCost"],
  ["/reports", "reports"],
  ["/settings", "admin"],
  ["/users", "admin"],
  ["/preview", "admin"],
];

const STAGE_HREF: Record<number, string> = { 2: "/receiving", 3: "/containers", 4: "/clearing", 5: "/transport", 6: "/warehouse" };

const matches = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
const canView = (access: Access | undefined) => access === "View" || access === "Enter" || access === "Full";

export const isPublicPath = (pathname: string) => PUBLIC_PATHS.some((path) => matches(pathname, path));

const ACCESS_ORDER: Access[] = ["None", "View", "Enter", "Full"];

/** Whether the user has at least `minimum` access, so pages can hide actions the API would refuse with 403. */
export function hasAccess(me: Pick<Me, "permissions">, capability: Capability, minimum: Access) {
  return ACCESS_ORDER.indexOf(me.permissions[capability] ?? "None") >= ACCESS_ORDER.indexOf(minimum);
}

/** Whether this user may open the page (B3.3). Pages the rules don't name are refused. */
export function canOpen(me: Pick<Me, "shell" | "permissions">, pathname: string) {
  if (isPublicPath(pathname) || SIGNED_IN_PATHS.some((path) => matches(pathname, path))) return true;
  if (matches(pathname, "/home")) return me.shell === "staff";
  if (pathname === "/") return me.shell === "management" && canView(me.permissions.dashboard);
  const rule = ROUTE_CAPABILITY.find(([prefix]) => matches(pathname, prefix));
  return rule ? canView(me.permissions[rule[1]]) : false;
}

/** B3 (N-b): the management sidebar filtered by permission, or Home plus "Your stage" for staff. */
export function navFor(me: Pick<Me, "shell" | "permissions" | "stages">): NavSection[] {
  if (me.shell === "staff") {
    const stageTitle = (href: string) => MANAGEMENT_NAV[1]!.items.find((item) => item.href === href)?.title ?? href;
    const stages = me.stages.map((stage) => STAGE_HREF[stage]).filter((href): href is string => Boolean(href));
    return [
      { items: [{ title: "Home", href: "/home" }] },
      ...(stages.length ? [{ label: "Your stage", items: stages.map((href) => ({ title: stageTitle(href), href })) }] : []),
    ];
  }
  return MANAGEMENT_NAV.map((section) => ({ ...section, items: section.items.filter((item) => canOpen(me, item.href)) })).filter(
    (section) => section.items.length > 0,
  );
}

/** B2: the second line of the sidebar user block. */
export const userDetail = (me: Pick<Me, "office" | "accessLabel">) =>
  me.office ? `${me.office.type} · ${me.accessLabel}` : me.accessLabel;
