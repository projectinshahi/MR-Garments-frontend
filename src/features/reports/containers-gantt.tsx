import { LegendSwatch } from "@/components/shared/progress";
import type { ContainerState } from "@/lib/api/types";
import { formatShortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import type { ContainersTimelineReport } from "./data/queries";
import { axisPercent, barSpan, timelineAxis } from "./report-logic";

const STATE = {
  sea: { bar: "bg-chart-1", swatch: "chart-1", legend: "On the sea", note: (date: string) => `ETA ${date}` },
  loading: { bar: "bg-chart-2", swatch: "chart-2", legend: "Loading, estimated", note: (date: string) => `Est. ${date} · loading` },
  arrived: { bar: "bg-chart-3", swatch: "chart-3", legend: "Arrived", note: (date: string) => `Arrived ${date}` },
} as const satisfies Record<ContainerState, unknown>;

const LEGEND: ContainerState[] = ["sea", "loading", "arrived"];

// 150 px container column, then the dated track (36_13.4_Containers_timeline.jpeg). The track scrolls inside the
// card below about 760 px instead of squeezing the bars.
const ROW = "grid grid-cols-[150px_minmax(0,1fr)]";

/** Gantt of container sea time over the report window: bars from loading to arrival, the red line at today. */
export function ContainersGantt({ data, today }: { data: ContainersTimelineReport; today: string }) {
  const axis = timelineAxis(data.from, data.to);
  const at = (date: string) => `${axisPercent(date, axis.start, axis.end)}%`;
  const showToday = today >= axis.start && today < axis.end;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div aria-hidden className={cn(ROW, "mt-1")}>
          <span />
          <div className="relative h-4">
            {axis.ticks.map((tick) => (
              <span
                key={tick}
                className="absolute top-0 -translate-x-1/2 text-xs leading-4 whitespace-nowrap text-muted-foreground"
                style={{ left: at(tick) }}
              >
                {formatShortDate(tick)}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mt-[11px]">
          <ul>
            {data.containers.map((c) => {
              const span = barSpan(c.loadedOn, c.arrival, axis);
              const note = STATE[c.status].note(formatShortDate(c.arrival));
              return (
                <li key={c.id} className={cn(ROW, "h-[52px] items-center border-b border-border-subtle")}>
                  <div className="min-w-0">
                    <p className="text-sm leading-4 font-bold">{c.number}</p>
                    <p className="text-[12.5px] leading-[14px] text-muted-foreground">{note}</p>
                  </div>
                  <div className="relative h-5">
                    <span
                      role="img"
                      aria-label={`${c.number}: loaded ${formatShortDate(c.loadedOn)}, ${note}`}
                      className={cn("absolute inset-y-0 rounded-md", STATE[c.status].bar)}
                      style={{ left: `${span.left}%`, width: `${span.width}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {showToday ? (
            <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 left-[150px]">
              <span className="absolute inset-y-0 w-0.5 bg-chart-5" style={{ left: at(today) }} />
            </div>
          ) : null}
        </div>

        <ul aria-label="Legend" className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12.5px] leading-[18px] text-muted-foreground">
          {LEGEND.map((state) => (
            <li key={state} className="flex items-center gap-1.5">
              <LegendSwatch color={STATE[state].swatch} />
              {STATE[state].legend}
            </li>
          ))}
          {showToday ? (
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-[3px] rounded-full bg-chart-5" />
              Today, {formatShortDate(today)}
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
