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
    case "dot":
      return <span className="size-3.5 shrink-0 rounded-full bg-primary" />;
    case "ring":
      return <span className="size-3.5 shrink-0 rounded-full border-2 border-primary/50 bg-card" />;
  }
}

export type JourneyStep = { title: React.ReactNode; lines?: React.ReactNode[]; marker: Marker; number?: number };

/**
 * Horizontal steps joined by a line. align="center": evenly spaced, centered labels (order overview journey).
 * align="edges": first label left-aligned, last right-aligned (container route: China port, sea, Kochi port).
 */
export function Journey({ steps, align = "center", className }: { steps: JourneyStep[]; align?: "center" | "edges"; className?: string }) {
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
          <li key={index} className={cn("relative flex flex-col gap-1.5", itemAlign)}>
            {align === "center" && !last ? <span aria-hidden className={cn(lineClass, "left-1/2 w-full")} /> : null}
            <span className="relative z-10">
              <MarkerIcon marker={step.marker} number={step.number} size="lg" />
            </span>
            <span className="text-[15px] leading-5 font-bold">{step.title}</span>
            {step.lines?.map((line, i) => (
              <span key={i} className="text-[13px] leading-[18px] text-muted-foreground">
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

/** Vertical progress list (clearing/transport progress, receiving history, latest activity, deliveries for a PO). */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {items.map((item, index) => {
        const muted = item.marker === "pending";
        const small = item.marker === "dot" || item.marker === "ring";
        return (
          <li key={index} className="relative flex gap-3 pb-4 last:pb-0">
            {index < items.length - 1 ? (
              <span aria-hidden className={cn("absolute w-0.5 bg-chip-muted", small ? "top-4 bottom-0 left-[6px]" : "top-7 bottom-1 left-[11px]")} />
            ) : null}
            <span className={cn("relative z-10 flex justify-center", small ? "w-3.5 pt-1" : "w-6")}>
              <MarkerIcon marker={item.marker} number={item.number} size="md" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className={cn("text-[15px] leading-6", muted ? "text-muted-foreground" : "font-bold")}>{item.title}</span>
              {item.detail ? <span className="text-[13px] leading-[18px] text-muted-foreground">{item.detail}</span> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
