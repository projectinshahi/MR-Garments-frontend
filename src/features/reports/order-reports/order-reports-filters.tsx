"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { useNavigate } from "@/components/layout/navigation-progress";
import { Button } from "@/components/ui/button";
import type { OrderReportsResponse } from "@/lib/api/reports-types";

import { isMonth, monthRange } from "../data/filters";
import { UrlSelect } from "../report-actions";
import { DATE_PARAMS, PAYMENT_OPTIONS, PO_PARAM, STATUS_OPTIONS } from "./params";

// The Order reports filters, all kept in the URL so the server page reloads its data: dropdowns through UrlSelect
// (?supplier, ?status, ?warehouse, ?paymentStatus) and a small form for the PO text and the order-date range (?po,
// ?from, ?to), applied on submit (Enter or Apply) like the calendar's period parameters.

const fieldBox = "flex h-10 items-center gap-[9px] rounded-lg border bg-card pr-2 pl-[15px] focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/25";
const fieldInput = "h-full min-w-0 bg-transparent text-sm text-label outline-none placeholder:text-placeholder";

export function OrderReportsFilters({ options }: { options: OrderReportsResponse["options"] }) {
  const suppliers = [{ value: "all", label: "All suppliers" }, ...options.suppliers.map((s) => ({ value: s.id, label: s.name }))];
  const warehouses = [{ value: "all", label: "All warehouses" }, ...options.warehouses.map((w) => ({ value: w.id, label: w.name }))];
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Suspense fallback={<TextFilters params={new URLSearchParams()} />}>
        <BoundTextFilters />
      </Suspense>
      <UrlSelect param="supplier" size="sm" label="Supplier" options={suppliers} />
      <UrlSelect param="status" size="sm" label="Status" options={STATUS_OPTIONS} />
      <UrlSelect param="warehouse" size="sm" label="Warehouse" options={warehouses} />
      <UrlSelect param="paymentStatus" size="sm" label="Payment" options={PAYMENT_OPTIONS} />
    </div>
  );
}

const TEXT_PARAMS = [PO_PARAM, ...DATE_PARAMS];

function BoundTextFilters() {
  const navigate = useNavigate();
  const pathname = usePathname();
  const params = useSearchParams();
  const hrefWith = (values: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const key of TEXT_PARAMS) {
      if (values[key]) next.set(key, values[key]);
      else next.delete(key);
    }
    return next.size ? `${pathname}?${next}` : pathname;
  };
  return (
    <TextFilters
      params={params}
      onApply={(values) => navigate(hrefWith(values))}
      onClear={() => navigate(hrefWith({}))}
    />
  );
}

/** Uncontrolled inputs seeded from the URL (the key remounts them when it changes), read on submit. */
function TextFilters({ params, onApply, onClear }: { params: URLSearchParams; onApply?: (values: Record<string, string>) => void; onClear?: () => void }) {
  // The hub's ?period=YYYY-MM stands in for the range (params.ts), so the inputs show that month's days.
  const period = params.get("period");
  const month = !params.get("from") && !params.get("to") && isMonth(period) ? monthRange(period) : null;
  const from = params.get("from") ?? month?.from ?? "";
  const to = params.get("to") ?? month?.to ?? "";
  return (
    <form
      key={params.toString()}
      className="flex flex-wrap items-center gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onApply?.(Object.fromEntries(TEXT_PARAMS.map((key) => [key, String(data.get(key) ?? "").trim()])));
      }}
    >
      <label className={fieldBox}>
        <span className="text-xs text-muted-foreground">PO</span>
        <input name={PO_PARAM} type="search" aria-label="PO number" placeholder="Any part of it" defaultValue={params.get(PO_PARAM) ?? ""} maxLength={50} className={`${fieldInput} w-32 [&::-webkit-search-cancel-button]:appearance-none`} />
      </label>
      <label className={fieldBox}>
        <span className="text-xs text-muted-foreground">Ordered from</span>
        <input name="from" type="date" aria-label="Order date from" defaultValue={from} max={to || undefined} className={fieldInput} />
      </label>
      <label className={fieldBox}>
        <span className="text-xs text-muted-foreground">to</span>
        <input name="to" type="date" aria-label="Order date to" defaultValue={to} min={from || undefined} className={fieldInput} />
      </label>
      <Button type="submit" variant="outline" className="h-10">
        Apply
      </Button>
      <Button type="button" variant="outline" className="h-10" disabled={!TEXT_PARAMS.some((key) => params.has(key))} onClick={onClear}>
        Clear
      </Button>
    </form>
  );
}
