import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-header";
import { getRoles } from "@/features/users/data/queries";
import { RolesTable } from "@/features/users/roles-table";
import { UsersHeader } from "@/features/users/users-header";

export const metadata: Metadata = { title: "Roles" };

// 49_16.3_Roles.jpeg, from ROL-1: read-only, so the header has no actions.
export default async function RolesPage() {
  const data = await getRoles();
  return (
    <>
      <UsersHeader />
      <PageContainer>
        <RolesTable {...data} />
        <p className="text-[12.75px] leading-4 text-muted-foreground">
          Full = see and change · Enter = add data for that stage only · View = look only. Roles are fixed in this first version.
        </p>
      </PageContainer>
    </>
  );
}
