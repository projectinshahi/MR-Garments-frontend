import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getEditUser } from "@/features/users/data/queries";
import { EditUserForm } from "@/features/users/edit-user-form";
import { PrototypeButton } from "@/features/users/prototype-button";
import { UsersHeader } from "@/features/users/users-header";

export const metadata: Metadata = { title: "Add or edit user" };

// 48_16.2_Add_or_edit_user.jpeg: editing Wang Fang. Saving is not part of the prototype (D5).
// The header buttons in 48 are padded 16 px (Button size="header" pads 14).
export default async function EditUserPage() {
  const data = await getEditUser();
  return (
    <>
      <UsersHeader
        actions={
          <>
            <Button asChild variant="outline" size="header" className="px-4">
              <Link href="/users">Cancel</Link>
            </Button>
            <PrototypeButton action="Save user" size="header" className="px-4">
              Save user
            </PrototypeButton>
          </>
        }
      />
      <PageContainer>
        <EditUserForm data={data} />
      </PageContainer>
    </>
  );
}
