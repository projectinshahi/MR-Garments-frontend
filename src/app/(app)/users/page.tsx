import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getUsersList } from "@/features/users/data/queries";
import { UsersHeader } from "@/features/users/users-header";
import { UsersList } from "@/features/users/users-list";

export const metadata: Metadata = { title: "Users" };

// 47_16.1_Users_list.jpeg, from USR-1. "+ Add user" opens the empty Add or edit user form.
export default async function UsersPage() {
  const data = await getUsersList();
  return (
    <>
      <UsersHeader
        actions={
          <Button asChild size="header">
            <Link href="/users/edit">+ Add user</Link>
          </Button>
        }
      />
      <PageContainer>
        <UsersList {...data} />
      </PageContainer>
    </>
  );
}
