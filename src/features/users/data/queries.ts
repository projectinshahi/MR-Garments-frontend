import { getRoleMatrix, listLocations, listUsers } from "@/lib/data/master";
import type { User } from "@/types/domain";

import * as fixtures from "./fixtures";

export type { RoleAbility, StageOption } from "./fixtures";

/** A users-list row: the master user plus whether its edit form is designed (only Wang Fang's, 48). */
export type UserRow = User & { editable: boolean };

export type UsersListData = Awaited<ReturnType<typeof getUsersList>>;
export type EditUserData = Awaited<ReturnType<typeof getEditUser>>;
export type RolesData = Awaited<ReturnType<typeof getRoles>>;

/** Users list (47): the eight master users and the six roles for the role filter. */
export async function getUsersList() {
  const [users, { roles }] = await Promise.all([listUsers(), getRoleMatrix()]);
  return { users: users.map((user): UserRow => ({ ...user, editable: user.id === fixtures.EDIT_USER_ID })), roles };
}

/** Add or edit user (48), prefilled for Wang Fang as in the reference. */
export async function getEditUser() {
  const [users, { roles }, locations] = await Promise.all([listUsers(), getRoleMatrix(), listLocations()]);
  const user = users.find((u) => u.id === fixtures.EDIT_USER_ID);
  if (!user) throw new Error(`Master user ${fixtures.EDIT_USER_ID} is missing.`);
  return structuredClone({
    user,
    ...fixtures.editUserDetails,
    stages: fixtures.editUserStages,
    roleCard: fixtures.chinaStaffRoleCard,
    roles,
    offices: locations.map((l) => l.name),
  });
}

/** Roles (49): the fixed permission matrix. */
export async function getRoles() {
  return getRoleMatrix();
}
