import { describe, expect, it } from "vitest";

import type { User } from "@/types/domain";

import { ALL, filterUsers, type UserFilters } from "./filter-users";

const user = (name: string, email: string, role: User["role"], status: User["status"] = "Active"): User => ({
  id: name,
  name,
  email,
  role,
  office: "Head office",
  lastSignIn: "Today, 09:12",
  status,
});

const users = [
  user("Suresh Menon", "suresh@mrgarments.com", "Management"),
  user("Wang Fang", "wang@mrgarments.com", "China staff"),
  user("Chen Yu", "chen@mrgarments.com", "China staff"),
  user("Old Account", "old@mrgarments.com", "India staff", "Inactive"),
];

const none: UserFilters = { query: "", role: ALL, status: ALL };
const names = (filters: Partial<UserFilters>) => filterUsers(users, { ...none, ...filters }).map((u) => u.name);

describe("filterUsers", () => {
  it("returns everyone without filters", () => {
    expect(names({})).toHaveLength(4);
  });

  it("searches name and email, ignoring case and spaces", () => {
    expect(names({ query: "  WANG " })).toEqual(["Wang Fang"]);
    expect(names({ query: "chen@" })).toEqual(["Chen Yu"]);
    expect(names({ query: "nobody" })).toEqual([]);
  });

  it("filters by role", () => {
    expect(names({ role: "China staff" })).toEqual(["Wang Fang", "Chen Yu"]);
  });

  it("filters by status", () => {
    expect(names({ status: "active" })).toEqual(["Suresh Menon", "Wang Fang", "Chen Yu"]);
    expect(names({ status: "inactive" })).toEqual(["Old Account"]);
  });

  it("combines filters", () => {
    expect(names({ query: "mrgarments", role: "China staff", status: "inactive" })).toEqual([]);
    expect(names({ query: "yu", role: "China staff", status: "active" })).toEqual(["Chen Yu"]);
  });
});

