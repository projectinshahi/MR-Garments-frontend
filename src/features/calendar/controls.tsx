"use client";

import { FilterSelect, type FilterOption } from "@/components/shared/filters";
import { notInPrototype } from "@/components/shared/prototype";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// D5 leaves for the calendar: none of these actions has a reference design.

/** A filter dropdown fixed on its first option; picking another one shows the prototype toast. */
export function PrototypeSelect({
  label,
  options,
  action,
  className,
}: {
  label: string;
  options: FilterOption[];
  action: string;
  className?: string;
}) {
  const first = options[0].value;
  return (
    <FilterSelect
      label={label}
      value={first}
      options={options}
      size="sm"
      className={className}
      onValueChange={(value) => {
        if (value !== first) notInPrototype(action);
      }}
    />
  );
}

/** ‹ › month and week navigation. */
export function NavButton({ label, direction }: { label: string; direction: "previous" | "next" }) {
  return (
    <Button variant="outline" aria-label={label} className="size-[30px] p-0 text-base font-normal" onClick={() => notInPrototype(label)}>
      <span aria-hidden>{direction === "previous" ? "‹" : "›"}</span>
    </Button>
  );
}

/** A PO number. No calendar PO has an order-detail page (only PO-2028 does), so every one shows the toast. */
export function PoButton({ po, className }: { po: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => notInPrototype(`Order ${po}`)}
      className={cn("block text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50", className)}
    >
      {po}
    </button>
  );
}
