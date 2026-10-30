import { notFound } from "next/navigation";

import { ApiError } from "@/lib/api/errors";
import { apiGet } from "@/lib/api/server";
import type { LocationRow, RecordStatus, Role, RolesResponse } from "@/lib/api/types";
import { getMe } from "@/lib/session";

import { toRoleRows, toUserRow } from "../user-rows";

// Users screens (47, 48, 49) read the Batch 1 API. These calls read the session cookie, so the pages render inside
// the (app) loading.tsx Suspense boundary.

/** USR-1 GET /api/v1/users: rows in creation order; the counts cover every user. */
export type UsersListResponse = {
  data: { id: string; name: string; email: string; role: Role; office: string | null; lastSignInAt: string | null; status: RecordStatus }[];
  counts: { active: number; inactive: number };
};

/** USR-2 GET /api/v1/users/:id (`user`); USR-3 and USR-4 answer `{ user }` too. */
export type UserDetail = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  officeId: string | null;
  office: string | null;
  language: string;
  status: RecordStatus;
  stages: number[];
  lastSignInAt: string | null;
};
export type UserOptions = { roles: Role[]; offices: { id: string; name: string }[]; languages: string[] };
export type UserDetailResponse = { user: UserDetail; options: UserOptions };

export type UsersListData = Awaited<ReturnType<typeof getUsersList>>;
export type EditUserData = Awaited<ReturnType<typeof getEditUser>>;
export type RolesData = Awaited<ReturnType<typeof getRoles>>;

/** The languages form 48 offers (the API accepts the same list). */
const LANGUAGES = ["English"];

/** Users list (47). Filters run on the client over every user, as before. */
export async function getUsersList() {
  const [list, { roles }] = await Promise.all([apiGet<UsersListResponse>("/users"), apiGet<RolesResponse>("/roles")]);
  const now = new Date();
  return { users: list.data.map((row) => toUserRow(row, now)), counts: list.counts, roles };
}

const notFoundOn404 = (error: unknown): never => {
  if (error instanceof ApiError && error.status === 404) notFound(); // E10
  throw error;
};

/**
 * Add or edit user (48). With an id: USR-2 (404 shows the not-found page). Without one (Add user): an empty form whose
 * choices come from ROL-1 and MD-13's active offices, because USR-2 needs an id. ROL-1 also feeds the role card (B5).
 * `isSelf` hides "Set a new password" on the signed-in user's own account: USR-4 refuses a self-change (403).
 */
export async function getEditUser(id: string | undefined) {
  const matrix = apiGet<RolesResponse>("/roles");
  if (!id) {
    const [roles, offices] = await Promise.all([matrix, apiGet<LocationRow[]>("/locations?status=Active")]);
    const options: UserOptions = { roles: roles.roles, offices: offices.map(({ id, name }) => ({ id, name })), languages: LANGUAGES };
    return { user: null, options, matrix: roles, isSelf: false };
  }
  const [detail, roles, me] = await Promise.all([
    apiGet<UserDetailResponse>(`/users/${encodeURIComponent(id)}`).catch(notFoundOn404),
    matrix,
    getMe(),
  ]);
  return { ...detail, matrix: roles, isSelf: detail.user.id === me?.id };
}

/** Roles (49): the ROL-1 matrix. */
export async function getRoles() {
  return toRoleRows(await apiGet<RolesResponse>("/roles"));
}
