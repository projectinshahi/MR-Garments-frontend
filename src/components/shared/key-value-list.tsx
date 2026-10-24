import { cn } from "@/lib/utils";

export type KeyValueItem = {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Muted label, used for cost sub-rows ("Customs duty", "Freight"). */
  muted?: boolean;
};

type KeyValueListProps = {
  items: KeyValueItem[];
  /** Total row under a 2 px navy rule ("Landed cost", "Total clearing cost"). */
  total?: { label: React.ReactNode; value: React.ReactNode };
  /** Bold values for fact lists (order terms, clearing details); regular for money lists. */
  boldValues?: boolean;
  /** Total row: default 16 px on a 24 px line, 12 px under the rule; sm 15 px on a 20 px line, 7 px under it (06, 08, 10, 11, 21). */
  size?: "default" | "sm";
  className?: string;
};

/** Label-left, value-right rows with 1 px dividers (money, order terms, clearing, transport, summaries). */
export function KeyValueList({ items, total, boldValues = false, size = "default", className }: KeyValueListProps) {
  return (
    <dl className={cn("flex flex-col text-sm", className)}>
      {items.map((item, index) => (
        <div key={index} className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-[7px] leading-5 last:border-b-0">
          <dt className={cn(item.muted && "text-muted-foreground")}>{item.label}</dt>
          <dd className={cn("text-right", boldValues && !item.muted && "font-bold")}>{item.value}</dd>
        </div>
      ))}
      {total ? (
        <div
          className={cn(
            "flex items-baseline justify-between gap-4 border-t-2 border-navy font-bold",
            size === "sm" ? "mt-0.5 pt-[7px] text-[15px] leading-5" : "mt-1 pt-3 text-base",
          )}
        >
          <dt>{total.label}</dt>
          <dd className="text-right">{total.value}</dd>
        </div>
      ) : null}
    </dl>
  );
}
