import Link from "next/link";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Callout, SectionCard } from "@/components/shared/cards";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";

import type { ReportCard, ReportsHubData } from "./data/queries";
import { HubFilters, PrototypeButton } from "./report-actions";
import { RecentDownloadsTable } from "./report-widgets";

/** Reports hub (32_13_Reports.jpeg): six report cards, recent downloads and the access note. */
export function ReportsHub({ data }: { data: ReportsHubData }) {
  return (
    <>
      <PageHeader
        title="Reports"
        titleAddon={<StatusPill tone="neutral">Management only</StatusPill>}
        actions={<HubFilters periods={data.periods} suppliers={data.suppliers} />}
      />
      <PageContainer>
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.cards.map((card) => (
            <ReportCardItem key={card.href} card={card} />
          ))}
        </ul>
        <SectionCard title="Recently downloaded" titleGap="none" className="px-[18px] pt-[13px] pb-[15.5px]">
          <div className="overflow-x-auto">
            <RecentDownloadsTable rows={data.recent} />
          </div>
        </SectionCard>
        <Callout size="xs">
          Data-entry staff, the clearing and transport staff included, cannot open this page. They can only add and
          update their own stage.
        </Callout>
      </PageContainer>
    </>
  );
}

// Card geometry from the reference: 15 px top, a two-line description slot, the 35 px stat strip, 32.5 px buttons; 219.5 px in all (the reference rows measure 219 and 220).
function ReportCardItem({ card }: { card: ReportCard }) {
  return (
    <li className="flex flex-col rounded-xl border bg-card px-5 pt-[15px] pb-[19px]">
      <p className="text-[11.5px] leading-4 font-bold tracking-[0.12em] text-primary uppercase">{card.category}</p>
      <h2 className="mt-[2.5px] text-[17.5px] leading-6 font-bold">{card.title}</h2>
      <p className="mt-1 min-h-10 text-[13.5px] leading-5 text-muted-foreground">{card.description}</p>
      <p className="mt-[15px] flex h-[35px] items-center rounded-lg bg-background px-3 text-[13.5px] font-bold text-label">
        {card.stat}
      </p>
      {/* Accessible names add the report, so the six identical button rows stay distinguishable. */}
      <div className="mt-[14.5px] flex flex-wrap gap-2">
        <Button asChild size="sm" className="h-[32.5px] px-[15px] text-[13.5px]">
          <Link href={card.href} aria-label={`Open report: ${card.title}`}>
            Open report
          </Link>
        </Button>
        <PrototypeButton
          action="Excel export"
          aria-label={`Excel export: ${card.title}`}
          variant="outline"
          size="sm"
          className="h-[32.5px] px-[11px] text-[13.5px] text-label"
        >
          Excel
        </PrototypeButton>
        <PrototypeButton
          action="PDF export"
          aria-label={`PDF export: ${card.title}`}
          variant="outline"
          size="sm"
          className="h-[32.5px] px-[11px] text-[13.5px] text-label"
        >
          PDF
        </PrototypeButton>
      </div>
    </li>
  );
}
