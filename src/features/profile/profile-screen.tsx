import Link from "next/link";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/cards";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import type { ProfileData } from "./data/queries";
import { NotificationSettings } from "./notification-settings";
import { ProfileDetailsForm } from "./profile-details-form";
import { SaveChangesButton } from "./save-changes-button";
import { cardClass, outlineButtonClass, rowDetailClass, rowTitleClass } from "./styles";

/**
 * My profile (51_17.2_My_profile.jpeg): details and password on the left, notification switches and Sign out in a
 * 400 px right column. Change password and Sign out are links (build plan §3); there is no auth logic.
 */
export function ProfileScreen({ data }: { data: ProfileData }) {
  return (
    <>
      <PageHeader title="My profile" actions={<SaveChangesButton />} />
      <PageContainer>
        <div className="grid items-start gap-(--page-gap) lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="flex min-w-0 flex-col gap-(--page-gap)">
            <ProfileDetailsForm details={data.details} languages={data.languages} />

            <SectionCard title="Password" titleGap="none" className={cardClass}>
              <div className="mt-[13.5px] flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className={rowTitleClass}>Password</p>
                  <p className={rowDetailClass}>Last changed {formatDate(data.passwordChangedOn)}</p>
                </div>
                <Button asChild variant="outline" className={cn("h-[42px]", outlineButtonClass)}>
                  <Link href="/change-password">Change password</Link>
                </Button>
              </div>
            </SectionCard>
          </div>

          <div className="flex min-w-0 flex-col gap-(--page-gap)">
            <NotificationSettings preferences={data.notifications} />
            <Button asChild variant="outline" className={cn("h-11 w-full", outlineButtonClass)}>
              <Link href="/login">Sign out</Link>
            </Button>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
