import { cn } from "@/lib/utils";

import { NavButton } from "./controls";
import type { DeliveryStatus } from "./data/queries";

/** Tints of the chips and event cards on the Month and Week views (on track is blue there, green in the list). */
export const STATUS_BG: Record<DeliveryStatus, string> = { late: "bg-danger-soft", "due-soon": "bg-warning-soft", "on-track": "bg-info-soft" };
export const STATUS_TEXT: Record<DeliveryStatus, string> = { late: "text-danger", "due-soon": "text-warning", "on-track": "text-info" };

const LEGEND: { status: DeliveryStatus; label: string }[] = [
  { status: "late", label: "Late" },
  { status: "due-soon", label: "Due within 2 days" },
  { status: "on-track", label: "On track" },
];

/** Legend swatch colors differ between the references: chart colors on the Month view, tone colors on the Week view. */
export const MONTH_SWATCHES: Record<DeliveryStatus, string> = { late: "bg-chart-5", "due-soon": "bg-chart-2", "on-track": "bg-chart-1" };
export const WEEK_SWATCHES: Record<DeliveryStatus, string> = { late: "bg-chart-5", "due-soon": "bg-warning", "on-track": "bg-info" };

/** ‹ title › with the status legend on the right: "October 2026", "28 Sep – 4 Oct 2026". */
export function CalendarToolbar({
  title,
  unit,
  swatches,
  className,
}: {
  title: string;
  unit: "month" | "week";
  swatches: Record<DeliveryStatus, string>;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2", className)}>
      <div className="flex items-center gap-3">
        <NavButton direction="previous" label={`Previous ${unit}`} />
        <h2 className="text-[19px] leading-6 font-bold">{title}</h2>
        <NavButton direction="next" label={`Next ${unit}`} />
      </div>
      <ul aria-label="Legend" className="flex flex-wrap items-center gap-x-3.5 text-sm text-muted-foreground">
        {LEGEND.map(({ status, label }) => (
          <li key={status} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2.5 rounded-[3px]", swatches[status])} />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
