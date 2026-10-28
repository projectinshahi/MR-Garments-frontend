import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { DeliveryStatus } from "./data/queries";
import type { PeriodLinks } from "./params";

/** Tints of the chips and event cards on the Month and Week views (on track is blue there, green in the list). */
export const STATUS_BG: Record<DeliveryStatus, string> = { late: "bg-danger-soft", "due-soon": "bg-warning-soft", "on-track": "bg-info-soft" };
export const STATUS_TEXT: Record<DeliveryStatus, string> = { late: "text-danger", "due-soon": "text-warning", "on-track": "text-info" };

const LEGEND: { status: DeliveryStatus; label: string }[] = [
  { status: "late", label: "Late" },
  { status: "due-soon", label: "Due within 7 days" },
  { status: "on-track", label: "On track" },
];

/** Legend swatch colors differ between the references: chart colors on the Month view, tone colors on the Week view. */
export const MONTH_SWATCHES: Record<DeliveryStatus, string> = { late: "bg-chart-5", "due-soon": "bg-chart-2", "on-track": "bg-chart-1" };
export const WEEK_SWATCHES: Record<DeliveryStatus, string> = { late: "bg-chart-5", "due-soon": "bg-warning", "on-track": "bg-info" };

const NAV = "size-[30px] p-0 text-base font-normal";

/**
 * ‹ title › Today, with the status legend on the right: "October 2026", "28 Sep – 4 Oct 2026". When the period has no
 * delivery (for the chosen supplier), a line under it says so.
 */
export function CalendarToolbar({
  title,
  unit,
  swatches,
  links,
  supplier,
  empty,
  className,
}: {
  title: string;
  unit: "month" | "week";
  swatches: Record<DeliveryStatus, string>;
  links: PeriodLinks;
  /** "all" or the supplier filtered on. */
  supplier: string;
  empty: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2", className)}>
      <div className="flex items-center gap-3">
        <Link href={links.previous} aria-label={`Previous ${unit}`} className={buttonVariants({ variant: "outline", className: NAV })}>
          <span aria-hidden>‹</span>
        </Link>
        <h2 className="text-[19px] leading-6 font-bold">{title}</h2>
        <Link href={links.next} aria-label={`Next ${unit}`} className={buttonVariants({ variant: "outline", className: NAV })}>
          <span aria-hidden>›</span>
        </Link>
        <Link href={links.today} className={buttonVariants({ variant: "outline", size: "sm", className: "h-[30px] px-2.5" })}>
          Today
        </Link>
      </div>
      <ul aria-label="Legend" className="flex flex-wrap items-center gap-x-3.5 text-sm text-muted-foreground">
        {LEGEND.map(({ status, label }) => (
          <li key={status} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2.5 rounded-[3px]", swatches[status])} />
            {label}
          </li>
        ))}
      </ul>
      {empty ? (
        <p className="w-full text-[12.5px] leading-4 text-muted-foreground">
          {supplier === "all" ? `No deliveries this ${unit}.` : `No deliveries from ${supplier} this ${unit}.`}
        </p>
      ) : null}
    </div>
  );
}
