import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { apiGet } from "@/lib/api/server";
import type { RolesResponse } from "@/lib/api/types";

import { getEditUser, getUsersList, type UsersListResponse } from "./queries";

vi.mock("@/lib/api/server", () => ({ apiGet: vi.fn() }));
vi.mock("@/lib/session", () => ({ getMe: async () => ({ id: "u-me" }) }));
const get = vi.mocked(apiGet);

const list: UsersListResponse = {
  data: [{ id: "u-api", name: "Api Test User", email: "api.user@example.com", role: "Accounts", office: null, lastSignInAt: null, status: "Active" }],
  counts: { active: 1, inactive: 0 },
};
const roles = { roles: ["Management", "Accounts"], capabilities: [], matrix: {} } as unknown as RolesResponse;

describe("Users list (47) reads USR-1 and ROL-1", () => {
  beforeEach(() => get.mockReset());

  it("shows the API's users and counts", async () => {
    get.mockImplementation(async (path) => (path === "/users" ? list : roles));
    const data = await getUsersList();
    expect(data.users).toEqual([
      { id: "u-api", name: "Api Test User", email: "api.user@example.com", role: "Accounts", office: "", lastSignIn: "–", status: "Active" },
    ]);
    expect(data.counts).toBe(list.counts);
    expect(data.roles).toEqual(roles.roles);
  });

  it("fails when the API fails, so the error page shows instead of sample users", async () => {
    const failure = new ApiError(500, "server_error", "Something went wrong.");
    get.mockImplementation(async (path) => {
      if (path === "/users") throw failure;
      return roles;
    });
    await expect(getUsersList()).rejects.toBe(failure);
  });
});

describe("Add or edit user (48)", () => {
  beforeEach(() => get.mockReset());

  it("marks the signed-in user's own account, whose password can't be set there (password policy)", async () => {
    get.mockImplementation(async (path) => (path === "/roles" ? roles : { user: { id: path === "/users/u-me" ? "u-me" : "u-other" }, options: {} }));
    expect((await getEditUser("u-me")).isSelf).toBe(true);
    expect((await getEditUser("u-other")).isSelf).toBe(false);
  });
});
