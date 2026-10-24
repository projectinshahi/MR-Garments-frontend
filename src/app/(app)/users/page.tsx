import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-header";
import { getUsersList } from "@/features/users/data/queries";
import { PrototypeButton } from "@/features/users/prototype-button";
import { UsersHeader } from "@/features/users/users-header";
import { UsersList } from "@/features/users/users-list";

export const metadata: Metadata = { title: "Users" };

// 47_16.1_Users_list.jpeg. An empty add form is not designed (D5).
export default async function UsersPage() {
  const data = await getUsersList();
  return (
    <>
      <UsersHeader
        actions={
          <PrototypeButton action="Add user" size="header">
            + Add user
          </PrototypeButton>
        }
      />
      <PageContainer>
        <UsersList {...data} />
      </PageContainer>
    </>
  );
}
