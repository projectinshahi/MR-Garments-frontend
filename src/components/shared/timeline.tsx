import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * check   = done, green filled circle with a check (journey, clearing/transport progress)
 * current = in progress, blue ring with its number
 * pending = not started, grey ring with its number
 * dot     = filled blue dot (activity, container route, receiving history)
 * ring    = hollow ring (earlier receiving events, route points not yet reached)
 */
export type Marker = "check" | "current" | "pending" | "dot" | "ring";

function MarkerIcon({ marker, number, size }: { marker: Marker; number?: number; size: "md" | "lg" }) {
  const box = size === "lg" ? "size-[30px]" : "size-6";
  switch (marker) {
    case "check":
      return (
        <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-success-strong text-white", box)}>
          <Check className={size === "lg" ? "size-4" : "size-3.5"} strokeWidth={3} aria-hidden />
        </span>
      );
    case "current":
    case "pending":
      return (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full border-2 bg-card text-xs font-bold",
            marker === "current" ? "border-primary text-primary" : "border-chip-muted text-muted-foreground",
            box,
          )}
        >
          {number}
        </span>
      );
    // block: Journey wraps markers in a plain span, where an inline span would ignore size-3.5 and render 0 × 0.
    case "dot":
      return <span className="block size-3.5 shrink-0 rounded-full bg-primary" />;
    case "ring":
      return <span className="block size-3.5 shrink-0 rounded-full border-2 border-primary/50 bg-card" />;
  }
}

export type JourneyStep = { title: React.ReactNode; lines?: React.ReactNode[]; marker: Marker; number?: number };

/**
 * Horizontal steps joined by a line. align="center": evenly spaced, centered labels (order overview journey).
 * align="edges": first label left-aligned, last right-aligned (container route: China port, sea, Kochi port).
 * size: default 15 px titles, 13 px lines 6 px apart; sm 14 px titles and 12.5 px lines with no gap (06, 10).
 */
export function Journey({
  steps,
  align = "center",
  size = "default",
  className,
}: {
  steps: JourneyStep[];
  align?: "center" | "edges";
  size?: "default" | "sm";
  className?: string;
}) {
  const sm = size === "sm";
  const allDone = steps.every((s) => s.marker === "check");
  const lineClass = cn("absolute h-[3px]", allDone ? "top-[13.5px] bg-success-strong" : "top-[5.5px] bg-primary/30");
  return (
    <ol className={cn("relative grid auto-cols-fr grid-flow-col", className)}>
      {align === "edges" ? <span aria-hidden className={cn(lineClass, "inset-x-[7px]")} /> : null}
      {steps.map((step, index) => {
        const first = index === 0;
        const last = index === steps.length - 1;
        const itemAlign =
          align === "edges" && first ? "items-start text-left" : align === "edges" && last ? "items-end text-right" : "items-center text-center";
        return (
          <li key={index} className={cn("relative flex flex-col", sm ? "" : "gap-1.5", itemAlign)}>
            {align === "center" && !last ? <span aria-hidden className={cn(lineClass, "left-1/2 w-full")} /> : null}
            <span className={cn("relative z-10", sm && "mb-1.5")}>
              <MarkerIcon marker={step.marker} number={step.number} size="lg" />
            </span>
            <span className={cn(sm ? "text-sm" : "text-[15px]", "leading-5 font-bold")}>{step.title}</span>
            {step.lines?.map((line, i) => (
              <span key={i} className={cn(sm ? "text-[12.5px] leading-[17.5px]" : "text-[13px] leading-[18px]", "text-muted-foreground")}>
                {line}
              </span>
            ))}
          </li>
        );
      })}
    </ol>
  );
}

export type TimelineItem = { title: React.ReactNode; detail?: React.ReactNode; marker: Marker; number?: number };

/**
 * Vertical progress list (clearing/transport progress, receiving history, latest activity, deliveries for a PO).
 * size: default 15 px titles on a 24 px line, 16 px between items; sm 14 px titles on a 20 px line, 12.5 px
 * detail, 12 px between items (06, 09, 21).
 */
export function Timeline({ items, size = "default", className }: { items: TimelineItem[]; size?: "default" | "sm"; className?: string }) {
  const sm = size === "sm";
  return (
    <ol className={cn("flex flex-col", className)}>
      {items.map((item, index) => {
        const muted = item.marker === "pending";
        const small = item.marker === "dot" || item.marker === "ring";
        return (
          <li key={index} className={cn("relative flex gap-3 last:pb-0", sm ? "pb-3" : "pb-4")}>
            {index < items.length - 1 ? (
              <span aria-hidden className={cn("absolute w-0.5 bg-chip-muted", small ? "top-4 bottom-0 left-[6px]" : "top-7 bottom-1 left-[11px]")} />
            ) : null}
            <span className={cn("relative z-10 flex justify-center", small ? cn("w-3.5", sm ? "pt-[3px]" : "pt-1") : "w-6")}>
              <MarkerIcon marker={item.marker} number={item.number} size="md" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className={cn(sm ? "text-sm leading-5" : "text-[15px] leading-6", muted ? "text-muted-foreground" : "font-bold")}>
                {item.title}
              </span>
              {item.detail ? (
                <span className={cn(sm ? "text-[12.5px]" : "text-[13px]", "leading-[18px] text-muted-foreground")}>{item.detail}</span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
