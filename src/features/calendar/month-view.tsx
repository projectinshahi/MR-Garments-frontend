import { format, isSameMonth, parseISO } from "date-fns";

import { PageContainer } from "@/components/layout/page-header";
import { BarChart } from "@/components/shared/bar-chart";
import { Callout, CardNote, SectionCard } from "@/components/shared/cards";
import { StatusPill } from "@/components/shared/status-pill";
import { MOCK_TODAY } from "@/lib/constants";
import { formatShortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import { CalendarToolbar, MONTH_SWATCHES, STATUS_BG, STATUS_TEXT } from "./calendar-toolbar";
import { PoButton } from "./controls";
import type { CalendarData } from "./data/queries";
import { deliveriesPerDay, dueOn, isoDay, lateBy, monthWeeks } from "./deliveries";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** a Month (18_6.a_Month.jpeg): month grid with PO chips, and the per-day, late and reminder cards. */
export function MonthView({ month, deliveries }: CalendarData) {
  const first = parseISO(month);
  const title = format(first, "MMMM yyyy");
  const late = deliveries.filter((d) => d.status === "late");

  return (
    <PageContainer>
      <div className="grid items-start gap-(--page-gap) lg:grid-cols-[minmax(0,1fr)_340px]">
        <SectionCard className="min-w-0 px-[18px] pb-4">
          <CalendarToolbar title={title} unit="month" swatches={MONTH_SWATCHES} className="mb-3" />
          <div className="overflow-x-auto">
            <div role="table" aria-label={title} className="grid min-w-[640px] grid-cols-7 border-t border-l">
              <div role="row" className="contents">
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    role="columnheader"
                    className="flex h-7 items-center border-r border-b bg-table-head px-[7px] text-[12.5px] font-bold text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
              </div>
              {monthWeeks(month).map((week) => (
                <div key={isoDay(week[0])} role="row" className="contents">
                  {week.map((day) => {
                    const items = dueOn(deliveries, day);
                    const outside = !isSameMonth(day, first);
                    const today = isoDay(day) === MOCK_TODAY;
                    return (
                      <div
                        key={isoDay(day)}
                        role="cell"
                        className={cn("h-[136px] border-r border-b px-[7px] pt-1", outside && "bg-table-head")}
                      >
                        <div className="flex h-5 items-start justify-between gap-1">
                          <span
                            aria-current={today ? "date" : undefined}
                            className={cn(
                              "text-[13px] leading-5 font-bold",
                              today
                                ? "-mt-px -ml-1 flex size-6 items-center justify-center rounded-full bg-primary text-white"
                                : outside
                                  ? "text-table-head-foreground/50"
                                  : "text-label",
                            )}
                          >
                            {format(day, day.getDate() === 1 ? "d MMM" : "d")}
                          </span>
                          {items.length ? (
                            <span className="text-[11px] leading-[18px] font-bold text-muted-foreground">
                              {items.length}
                              <span className="sr-only"> {items.length === 1 ? "delivery" : "deliveries"}</span>
                            </span>
                          ) : null}
                        </div>
                        {items.length ? (
                          <ul className="mt-0.5 flex flex-col gap-[3px]">
                            {items.map((d) => (
                              <li key={d.po}>
                                <PoButton
                                  po={d.po}
                                  className={cn("h-[18px] w-full rounded-[5px] px-1.5 text-xs leading-[18px] font-bold", STATUS_BG[d.status], STATUS_TEXT[d.status])}
                                />
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <div className="flex flex-col gap-(--page-gap)">
          <SectionCard title="Deliveries per day" aside={<CardNote>next 7 days</CardNote>}>
            <BarChart size="sm" data={deliveriesPerDay(deliveries)} label="Deliveries per day, next 7 days" className="h-[126px]" />
          </SectionCard>

          <SectionCard title="Late deliveries" titleGap="none" aside={<StatusPill tone="danger">{late.length}</StatusPill>}>
            <ul aria-label="Late deliveries" className="mt-1">
              {late.map((d) => (
                <li key={d.po} className="flex items-center justify-between gap-3 border-b border-border-subtle py-[9px] last:border-0 last:pb-2">
                  <div className="min-w-0">
                    <PoButton po={d.po} className="text-sm leading-[18px] font-bold" />
                    <p className="text-[12.5px] leading-4 text-muted-foreground">
                      {d.supplier} · due {formatShortDate(d.due)}
                    </p>
                  </div>
                  <StatusPill tone="danger">{lateBy(d.due)}</StatusPill>
                </li>
              ))}
            </ul>
          </SectionCard>

          <Callout tone="info" className="rounded-xl border border-info/15 px-5 pt-[13px] pb-[19px]">
            <h2 className="text-base leading-[22px] font-bold text-info">Reminders</h2>
            <p className="mt-[5px] text-[13.5px] leading-[21px]">
              A notification goes to procurement and management the day before each delivery is due, and again on the due date.
            </p>
          </Callout>
        </div>
      </div>
    </PageContainer>
  );
}
