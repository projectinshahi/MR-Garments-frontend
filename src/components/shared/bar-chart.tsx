"use client";

import { Bar, BarChart as RechartsBarChart, Cell, LabelList, XAxis } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export type BarDatum = { label: string; value: number };

const config = { value: { label: "Value", color: "var(--chart-1)" } } satisfies ChartConfig;

const SIZES = {
  default: { tick: 14, tickMargin: 10, top: 28, gap: "18%", value: "text-sm", offset: 8, axisHeight: null },
  // Side-card chart, Deliveries per day on the Delivery Calendar (18): 11 px days 5.5 px under the axis (Recharts
  // adds its 6 px tick size even without tick lines), 12 px values, bars 84 % of the band (gap applies per side).
  sm: { tick: 11, tickMargin: 0, top: 18, gap: "8%", value: "text-xs", offset: 7, axisHeight: 18 },
} as const;

/**
 * Vertical bars with the value printed above each bar and muted category labels (deliveries per day,
 * landed cost by month). Zero values render as a thin track bar, as in the references. Every category label
 * is drawn (interval 0); `size="sm"` sets the smaller side-card type so seven day labels fit a 290 px chart.
 */
export function BarChart({
  data,
  label,
  formatValue = String,
  size = "default",
  className,
}: {
  data: BarDatum[];
  /** Accessible description of the chart. */
  label: string;
  formatValue?: (value: number) => string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <figure aria-label={label} className={cn("w-full", className)}>
      <ChartContainer config={config} className="aspect-auto h-full w-full">
        <RechartsBarChart data={data} margin={{ top: s.top, right: 0, bottom: 0, left: 0 }} barCategoryGap={s.gap}>
          <XAxis
            dataKey="label"
            interval={0}
            {...(s.axisHeight ? { height: s.axisHeight } : {})}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tickMargin={s.tickMargin}
            tick={{ fill: "var(--muted-foreground)", fontSize: s.tick }}
          />
          <Bar dataKey="value" radius={[5, 5, 0, 0]} minPointSize={3} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.value === 0 ? "var(--chart-track)" : "var(--chart-1)"} />
            ))}
            <LabelList dataKey="value" position="top" offset={s.offset} formatter={(v: unknown) => formatValue(Number(v))} className={cn("fill-foreground font-bold", s.value)} />
          </Bar>
        </RechartsBarChart>
      </ChartContainer>
    </figure>
  );
}
