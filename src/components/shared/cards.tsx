import Link from "next/link";

import { formatToday } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type SectionCardProps = Omit<React.ComponentProps<"section">, "title"> & {
  title?: React.ReactNode;
  /** Right side of the title row: a CardLink ("View all orders") or a muted note ("next 7 days"). */
  aside?: React.ReactNode;
};

/** White card, 12 px radius, 1 px border, 20 px padding, 16 px bold title. */
export function SectionCard({ title, aside, className, children, ...props }: SectionCardProps) {
  return (
    <section className={cn("rounded-xl border bg-card px-5 pt-4 pb-5", className)} {...props}>
      {title || aside ? (
        <div className="mb-4 flex items-baseline justify-between gap-4">
          {title ? <h2 className="text-base leading-[22px] font-bold">{title}</h2> : <span />}
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function CardLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return <Link className={cn("text-[15px] font-bold text-primary hover:underline", className)} {...props} />;
}

export function CardNote({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

type KpiCardProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  /** "danger" renders the value in strong red (late counts, shortages). */
  tone?: "default" | "danger";
  className?: string;
};

/** KPI tile: 13 px label, 30 px bold value, 13 px sub-line (about 104 px tall). */
export function KpiCard({ label, value, sub, tone = "default", className }: KpiCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card px-5 pt-4 pb-3", className)}>
      <p className="text-[13px] leading-[18px] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-[30px] leading-9 font-bold", tone === "danger" && "text-danger-strong")}>{value}</p>
      {sub ? <p className="text-[13px] leading-[18px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

/** Equal-width row of KpiCards (3–5 per row in the references). */
export function KpiRow({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-(--page-gap) md:auto-cols-fr md:grid-flow-col", className)} {...props} />;
}

const CALLOUT_TONES = {
  info: "bg-callout-info text-callout-info-foreground",
  success: "bg-success-soft text-callout-success-foreground",
  warning: "border border-callout-warning-border bg-callout-warning text-callout-warning-foreground",
};

/** Tinted note box: "How the INR figure is found", "Good to know", the late-deliveries banner. */
export function Callout({ tone = "info", className, ...props }: React.ComponentProps<"div"> & { tone?: keyof typeof CALLOUT_TONES }) {
  return <div className={cn("rounded-[10px] px-4 py-3 text-[15px] leading-5", CALLOUT_TONES[tone], className)} {...props} />;
}

/** "Today, 30 Sep 2026" (dashboard, calendar) or "Wed, 30 Sep 2026" (staff home), from MOCK_TODAY. */
export function TodayPill({ style = "today" }: { style?: "today" | "weekday" }) {
  return (
    <span className="inline-flex h-[31px] items-center rounded-lg bg-callout-info px-3.5 text-sm font-bold text-primary">
      {formatToday(style)}
    </span>
  );
}
