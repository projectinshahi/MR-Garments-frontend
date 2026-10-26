import type { RolesResponse } from "@/lib/api/types";
import type { RoleMatrixRow, User } from "@/types/domain";

import type { UsersListResponse } from "./data/queries";

// India time, as the rest of the app (the API's development links print IST). India has no daylight saving, so the
// day before is always 24 hours earlier.
const DAY_MS = 24 * 60 * 60 * 1000;
const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function partsOf(date: Date) {
  const p = Object.fromEntries(PARTS.formatToParts(date).map(({ type, value }) => [type, value]));
  return { day: `${p.year}-${p.month}-${p.day}`, year: p.year, label: `${p.day} ${p.month}`, time: `${p.hour}:${p.minute}` };
}

/** "Today, 09:12" · "Yesterday, 15:31" · "26 Sep, 14:02" as on 47, in India time; "–" before the first sign-in (5.6). */
export function formatLastSignIn(value: string | null, now: Date) {
  if (!value) return "–";
  const at = partsOf(new Date(value));
  const today = partsOf(now);
  if (at.day === today.day) return `Today, ${at.time}`;
  if (at.day === partsOf(new Date(now.getTime() - DAY_MS)).day) return `Yesterday, ${at.time}`;
  return `${at.label}${at.year === today.year ? "" : ` ${at.year}`}, ${at.time}`;
}

/** A USR-1 row as 47 shows it: Head office users have no office yet (U28), so the cell stays empty. */
export const toUserRow = (row: UsersListResponse["data"][number], now: Date): User => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  office: row.office ?? "",
  lastSignIn: formatLastSignIn(row.lastSignInAt, now),
  status: row.status,
});

/** ROL-1 as the Roles table's rows (49), in the API's capability order. */
export const toRoleRows = ({ roles, capabilities, matrix }: RolesResponse): { roles: RolesResponse["roles"]; rows: RoleMatrixRow[] } => ({
  roles,
  rows: capabilities.map(({ key, label }) => ({ capability: label, access: matrix[key] })),
});
