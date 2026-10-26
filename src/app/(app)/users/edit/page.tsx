import type { Metadata } from "next";

import { getEditUser } from "@/features/users/data/queries";
import { EditUserForm } from "@/features/users/edit-user-form";

export const metadata: Metadata = { title: "Add or edit user" };

// 48_16.2_Add_or_edit_user.jpeg. /users/edit?id=<id> edits a user (USR-2, USR-4); without an id it adds one (USR-3).
// Keyed by the id: switching user (a search-param-only navigation) starts a fresh form instead of keeping the last one.
export default async function EditUserPage({ searchParams }: PageProps<"/users/edit">) {
  const { id } = await searchParams;
  const data = await getEditUser(typeof id === "string" && id ? id : undefined);
  return <EditUserForm key={data.user?.id ?? "new"} {...data} />;
}
