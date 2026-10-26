import type { RecordStatus, Role, User } from "@/types/domain";

export const ALL = "all";

export type UserStatusFilter = "active" | "inactive" | typeof ALL;

export type UserFilters = {
  /** Matches the name or the email, case-insensitive. */
  query: string;
  role: Role | typeof ALL;
  status: UserStatusFilter;
};

const STATUS: Record<Exclude<UserStatusFilter, typeof ALL>, RecordStatus> = { active: "Active", inactive: "Inactive" };

export function filterUsers<T extends User>(users: T[], { query, role, status }: UserFilters): T[] {
  const q = query.trim().toLowerCase();
  return users.filter(
    (user) =>
      (!q || user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q)) &&
      (role === ALL || user.role === role) &&
      (status === ALL || user.status === STATUS[status]),
  );
}
