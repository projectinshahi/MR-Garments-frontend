"use client";

import { Bar, BarChart as RechartsBarChart, Cell, LabelList, XAxis } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export type BarDatum = { label: string; value: number };

const config = { value: { label: "Value", color: "var(--chart-1)" } } satisfies ChartConfig;

/**
 * Vertical bars with the value printed above each bar and muted category labels (deliveries per day,
 * landed cost by month). Zero values render as a thin track bar, as in the references.
 */
export function BarChart({
  data,
  label,
  formatValue = String,
  className,
}: {
  data: BarDatum[];
  /** Accessible description of the chart. */
  label: string;
  formatValue?: (value: number) => string;
  className?: string;
}) {
  return (
    <figure aria-label={label} className={cn("w-full", className)}>
      <ChartContainer config={config} className="aspect-auto h-full w-full">
        <RechartsBarChart data={data} margin={{ top: 28, right: 0, bottom: 0, left: 0 }} barCategoryGap="18%">
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--border)" }} tickMargin={10} tick={{ fill: "var(--muted-foreground)", fontSize: 14 }} />
          <Bar dataKey="value" radius={[5, 5, 0, 0]} minPointSize={3} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.value === 0 ? "var(--chart-track)" : "var(--chart-1)"} />
            ))}
            <LabelList dataKey="value" position="top" offset={8} formatter={(v: unknown) => formatValue(Number(v))} className="fill-foreground text-sm font-bold" />
          </Bar>
        </RechartsBarChart>
      </ChartContainer>
    </figure>
  );
}
