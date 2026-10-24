import Link from "next/link";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Callout, CardNote, SectionCard, TodayPill } from "@/components/shared/cards";
import { Button } from "@/components/ui/button";

import type { StaffHomeData } from "./data/queries";
import { waitingSummary } from "./staff-home-logic";
import { RecentReceiptsTable, WaitingTable } from "./staff-home-tables";

/**
 * Staff home for the entry-only China staff role (39_14_Staff_home.jpeg): a welcome banner, the orders waiting
 * to be received, the receipts this user entered, and what the account can and cannot see.
 * Spacing measured from the reference: left cards 18 px side / 12 px top / 16 px bottom padding, right cards
 * 14 px top / 18 px bottom, 16 px between stacked cards and 18 px between the columns.
 */
export function StaffHomeScreen({ data }: { data: StaffHomeData }) {
  return (
    <>
      <PageHeader title="Home" actions={<TodayPill style="weekday" size="sm" />} />
      <PageContainer>
        <section
          aria-labelledby="staff-home-greeting"
          className="flex min-h-[92px] flex-wrap items-center justify-between gap-4 rounded-xl bg-linear-135 from-sidebar-from to-sidebar-to px-[26px] py-4 text-white"
        >
          <div>
            <h2 id="staff-home-greeting" className="text-[23px] leading-7 font-bold">
              {data.greeting}
            </h2>
            <p className="mt-[2.5px] text-[14.5px] leading-5 text-sidebar-foreground">{waitingSummary(data.waitingOrders.length)}</p>
          </div>
          {/* The white banner button keeps navy text (39); other outline buttons in the references are slate. */}
          <Button asChild variant="outline" className="h-[41px] px-[19px] text-[15px] text-foreground">
            <Link href="/receiving/new">+ Record a receipt</Link>
          </Button>
        </section>

        <div className="grid items-start gap-x-(--page-gap) gap-y-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-4">
            <SectionCard
              title="Waiting for you"
              aria-label="Waiting for you"
              aside={<CardNote size="sm">Orders not yet received in China</CardNote>}
              titleGap="none"
              className="px-[18px] pt-3 pb-4"
            >
              <WaitingTable rows={data.waitingOrders} />
            </SectionCard>
            <SectionCard title="Entered by you recently" aria-label="Entered by you recently" titleGap="none" className="px-[18px] pt-3 pb-4">
              <RecentReceiptsTable rows={data.recentReceipts} />
            </SectionCard>
          </div>

          <div className="flex flex-col gap-4">
            <SectionCard title="What you can do" titleGap="none" bottomGap="form" className="pt-3.5">
              <AccessList items={data.allowedActions} allowed />
            </SectionCard>
            <SectionCard title="Not shown to your account" titleGap="none" bottomGap="form" className="pt-3.5">
              <AccessList items={data.hiddenAreas} allowed={false} />
            </SectionCard>
            <Callout size="xs">
              <p>
                <span className="block">Each staff member sees only the stage they work on.</span>
                <span className="block">Clearing agents and transporters do not log in.</span>
              </p>
            </Callout>
          </div>
        </div>
      </PageContainer>
    </>
  );
}

/** Rows with a 22 px marker circle: a green check (allowed) or a muted dash (not shown), split by thin rules. */
function AccessList({ items, allowed }: { items: string[]; allowed: boolean }) {
  return (
    <ul className="mt-3.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 border-b border-border-subtle py-[9px] last:border-b-0">
          <span
            aria-hidden
            className={
              allowed
                ? "mt-px flex size-[22px] shrink-0 items-center justify-center rounded-full bg-success-soft text-success"
                : "mt-px flex size-[22px] shrink-0 items-center justify-center rounded-full bg-neutral-soft"
            }
          >
            {allowed ? <CheckGlyph /> : <span className="mt-[1.5px] block h-[1.5px] w-1.5 bg-muted-foreground" />}
          </span>
          <span className={allowed ? "text-sm leading-4" : "text-sm leading-4 text-muted-foreground"}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** The small heavy check drawn in the reference's marker circles (about 7 × 7 px). */
function CheckGlyph() {
  return (
    <svg viewBox="-4 -4 8 8" className="size-2" fill="none" aria-hidden>
      <path d="M-2.7 0.4 L-1.4 2.2 L2.7 -3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
