import { cn } from "@/lib/utils";
import type { Terms, Tone } from "@/types/domain";

const TONES: Record<Tone, string> = {
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
  purple: "bg-purple-soft text-purple",
  neutral: "bg-neutral-soft text-neutral",
};

/** 20 px tinted pill: "Late 4 days", "On track", "Active", "Management only". */
export function StatusPill({ tone = "neutral", className, ...props }: React.ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex h-5 shrink-0 items-center rounded-full px-2.5 text-xs font-bold whitespace-nowrap", TONES[tone], className)}
      {...props}
    />
  );
}

const TERMS: Record<Terms, string> = {
  FOB: "border-info/25 bg-info-soft text-info",
  CNF: "border-purple-border bg-purple-soft text-purple",
};

/** Boxed FOB/CNF badge: sm in tables (containers list), md on cards (order terms, container). */
export function TermsBadge({ terms, size = "sm", className }: { terms: Terms; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border font-bold",
        size === "sm" ? "h-[27px] px-3 text-sm" : "h-[34px] px-4 text-base",
        TERMS[terms],
        className,
      )}
    >
      {terms}
    </span>
  );
}
