import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { getLoadContainer } from "@/features/containers/data/queries";
import { LoadContainerScreen } from "@/features/containers/load-container-screen";
import { MESSAGES } from "@/lib/feedback";

export const metadata: Metadata = { title: "Load container" };

export default async function LoadContainerPage() {
  const data = await getLoadContainer();
  // Containers below Enter (for example View only): CON-2 would refuse, so say so instead of the error page.
  if (!data) {
    return (
      <>
        <PageHeader title="Load container" parent={{ label: "Containers", href: "/containers" }} />
        <PageContainer>
          <EmptyState
            title={MESSAGES.noAccess}
            action={
              <Button asChild variant="outline">
                <Link href="/containers">Back to Containers</Link>
              </Button>
            }
          />
        </PageContainer>
      </>
    );
  }
  // The page stays mounted (Activity): any change in CON-2's lines or agents remounts the form from the fresh data.
  return <LoadContainerScreen key={JSON.stringify(data)} {...data} />;
}
