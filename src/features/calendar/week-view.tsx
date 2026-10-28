import { format } from "date-fns";

import { PageContainer } from "@/components/layout/page-header";
import { Callout, SectionCard } from "@/components/shared/cards";
import { PoLink } from "@/components/shared/po-link";
import { formatQty, formatShortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import { CalendarToolbar, STATUS_BG, STATUS_TEXT, WEEK_SWATCHES } from "./calendar-toolbar";
import type { CalendarData } from "./data/queries";
import { dueOn, isoDay, weekDays } from "./deliveries";
import { filterDeliveries, readFilters, weekLinks, weekParam } from "./params";

/**
 * b Week (19_6.b_Week.jpeg): late banner and seven day columns of delivery cards. `?week=YYYY-MM-DD` picks the week
 * (Monday first) and `?supplier=` filters every part of the view.
 */
export function WeekView({ today, deliveries: all, linkOrders, params }: CalendarData & { params: URLSearchParams }) {
  const days = weekDays(weekParam(params, today));
  const { supplier } = readFilters(params, all);
  const deliveries = filterDeliveries(all, today, supplier);
  const title = `${format(days[0], "d MMM")} – ${format(days[6], "d MMM yyyy")}`;
  const lateBefore = deliveries.filter((d) => d.status === "late" && d.due < isoDay(days[0]));

  return (
    <PageContainer>
      {lateBefore.length ? (
        <Callout tone="warning" size="sm" className="py-[11px]">
          <strong>Late from before this week:</strong>{" "}
          {lateBefore.map((d) => `${d.po} ${d.supplier} (due ${formatShortDate(d.due)}, ${d.statusLabel})`).join(" · ")}
        </Callout>
      ) : null}

      <SectionCard className="p-0">
        <CalendarToolbar
          title={title}
          unit="week"
          swatches={WEEK_SWATCHES}
          links={weekLinks(params, isoDay(days[0]))}
          supplier={supplier}
          empty={!days.some((day) => dueOn(deliveries, day).length)}
          className="min-h-[57px] border-b px-[18px] py-2"
        />
        <div className="overflow-x-auto">
          <div role="table" aria-label={title} className="grid min-w-[980px] grid-cols-7">
            <div role="row" className="contents">
              {days.map((day) => {
                const isToday = isoDay(day) === today;
                return (
                  <div
                    key={isoDay(day)}
                    role="columnheader"
                    className={cn(
                      "flex h-[38px] items-center border-r border-b px-3 text-[13px] leading-5 font-bold text-muted-foreground last:border-r-0",
                      isToday ? "bg-callout-info" : "bg-table-head",
                    )}
                  >
                    <span>
                      {format(day, "EEE")}{" "}
                      <span className={cn("ml-1 text-[15px]", isToday ? "text-primary" : "text-foreground")}>{format(day, "d MMM")}</span>
                      {isToday ? " · Today" : null}
                    </span>
                  </div>
                );
              })}
            </div>
            <div role="row" className="contents">
              {days.map((day) => {
                const items = dueOn(deliveries, day);
                return (
                  <div key={isoDay(day)} role="cell" className="min-h-[561px] border-r px-[11px] pt-3 pb-4 last:border-r-0">
                    {items.length ? (
                      <ul className="flex flex-col gap-2.5">
                        {items.map((d) => (
                          <li key={d.po} className={cn("rounded-[10px] px-2.5 py-[9px]", STATUS_BG[d.status])}>
                            <PoLink po={d.po} linked={linkOrders} className={cn("block w-fit text-sm leading-5", STATUS_TEXT[d.status])} />
                            <p className="text-[12.5px] leading-[14px]">{d.supplier}</p>
                            <p className="mt-px text-[12.5px] leading-[14px]">
                              {d.item} · {formatQty(d.quantity, d.unit)}
                            </p>
                            <p className={cn("mt-0.5 text-xs leading-4 font-bold", STATUS_TEXT[d.status])}>{d.statusLabel}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="pt-[17px] text-center text-[12.5px] leading-4 text-muted-foreground">No deliveries</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </SectionCard>
    </PageContainer>
  );
}
