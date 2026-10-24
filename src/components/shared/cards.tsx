import Link from "next/link";

import { formatToday } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type SectionCardProps = Omit<React.ComponentProps<"section">, "title"> & {
  title?: React.ReactNode;
  /** Right side of the title row: a CardLink ("View all orders") or a muted note ("next 7 days"). */
  aside?: React.ReactNode;
  /** Space between the title row and the content: 16 px, or none for a dense DataTable header right under the title. */
  titleGap?: "default" | "none";
};

/** White card, 12 px radius, 1 px border, 20 px padding, 16 px bold title. */
export function SectionCard({ title, aside, titleGap = "default", className, children, ...props }: SectionCardProps) {
  return (
    <section className={cn("rounded-xl border bg-card px-5 pt-4 pb-5", className)} {...props}>
      {title || aside ? (
        <div className={cn("flex items-baseline justify-between gap-4", titleGap === "default" && "mb-4")}>
          {title ? <h2 className="text-base leading-[22px] font-bold">{title}</h2> : <span />}
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Title-row link: 15 px, or 13 px (`size="sm"`) as on the dashboard cards. */
export function CardLink({ size = "default", className, ...props }: React.ComponentProps<typeof Link> & { size?: "default" | "sm" }) {
  return (
    <Link
      className={cn(size === "sm" ? "text-[13px]" : "text-[15px]", "font-bold text-primary hover:underline", className)}
      {...props}
    />
  );
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
  /** default 106 px tall; sm 104 px with the text set tighter, as on the dashboard (04). */
  size?: "default" | "sm";
  className?: string;
};

/** KPI tile: 13 px label, 30 px bold value, 13 px sub-line. */
export function KpiCard({ label, value, sub, tone = "default", size = "default", className }: KpiCardProps) {
  const sm = size === "sm";
  return (
    <div className={cn("rounded-xl border bg-card px-5", sm ? "pt-[15px] pb-[10.5px]" : "pt-4 pb-3", className)}>
      <p className="text-[13px] leading-[18px] text-muted-foreground">{label}</p>
      <p className={cn(sm ? "mt-[3px]" : "mt-1", "text-[30px] leading-9 font-bold", tone === "danger" && "text-danger-strong")}>{value}</p>
      {sub ? <p className={cn("text-[13px] leading-[18px] text-muted-foreground", sm && "mt-[1.5px]")}>{sub}</p> : null}
    </div>
  );
}

/** Equal-width row of KpiCards (3–5 per row in the references): 18 px gap, or 16 px (`gap="sm"`, dashboard). */
export function KpiRow({ gap = "default", className, ...props }: React.ComponentProps<"div"> & { gap?: "default" | "sm" }) {
  return (
    <div
      className={cn("grid md:auto-cols-fr md:grid-flow-col", gap === "sm" ? "gap-4" : "gap-(--page-gap)", className)}
      {...props}
    />
  );
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

/**
 * "Today, 30 Sep 2026" (dashboard, calendar) or "Wed, 30 Sep 2026" (staff home), from MOCK_TODAY.
 * Text is 14 px, or 13.5 px with `size="sm"` (dashboard).
 */
export function TodayPill({ style = "today", size = "default" }: { style?: "today" | "weekday"; size?: "default" | "sm" }) {
  return (
    <span
      className={cn(
        "inline-flex h-[31px] items-center rounded-lg bg-callout-info px-3.5 font-bold text-primary",
        size === "sm" ? "text-[13.5px]" : "text-sm",
      )}
    >
      {formatToday(style)}
    </span>
  );
}
