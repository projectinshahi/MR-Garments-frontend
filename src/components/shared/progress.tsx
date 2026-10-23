import { cn } from "@/lib/utils";
import { STAGES, type StageNumber } from "@/types/domain";

/** Horizontal bar on a light track: "lg" (18 px; orders by stage, quantity by size) or "sm" (8 px; cost by team). */
export function ProgressBar({
  value,
  max,
  size = "lg",
  label,
  className,
}: {
  value: number;
  max: number;
  size?: "sm" | "lg";
  /** Accessible name. */
  label: string;
  className?: string;
}) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn("w-full overflow-hidden bg-chart-track", size === "lg" ? "h-[18px] rounded-md" : "h-2 rounded-full", className)}
    >
      <div className={cn("h-full bg-primary", size === "lg" ? "rounded-md" : "rounded-full")} style={{ width: `${percent}%` }} />
    </div>
  );
}

/** Six 16 × 6 segments plus caption ("2. Receiving in China"), as in the orders list. */
export function StageProgress({ stage, className }: { stage: StageNumber; className?: string }) {
  const caption = `${stage}. ${STAGES[stage - 1]}`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div aria-hidden className="flex gap-[3.5px]">
        {STAGES.map((name, index) => (
          <span key={name} className={cn("h-1.5 w-4 rounded-full", index < stage ? "bg-primary" : "bg-chip-muted")} />
        ))}
      </div>
      <span className="text-[13px] leading-4 text-muted-foreground">
        <span className="sr-only">Stage </span>
        {caption}
      </span>
    </div>
  );
}

export type StackedSegment = { label: string; value: number; color: "chart-1" | "chart-2" | "chart-3" | "chart-4" };

const SEGMENT_COLORS: Record<StackedSegment["color"], string> = {
  "chart-1": "bg-chart-1",
  "chart-2": "bg-chart-2",
  "chart-3": "bg-chart-3",
  "chart-4": "bg-chart-4",
};

/** "Where the money goes" bar (cost tab, landed cost). Render the legend rows next to it with screen markup. */
export function StackedBar({ segments, className }: { segments: StackedSegment[]; className?: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <div
      role="img"
      aria-label={segments.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(", ")}
      className={cn("flex h-[34px] gap-0.5 overflow-hidden rounded-md", className)}
    >
      {segments.map((s) => (
        <span key={s.label} className={SEGMENT_COLORS[s.color]} style={{ flexGrow: s.value, flexBasis: 0 }} />
      ))}
    </div>
  );
}

/** Square legend swatch matching a StackedBar segment color. */
export function LegendSwatch({ color }: { color: StackedSegment["color"] }) {
  return <span aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-[3px]", SEGMENT_COLORS[color])} />;
}
