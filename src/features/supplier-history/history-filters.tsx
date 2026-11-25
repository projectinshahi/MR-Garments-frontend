"use client";

import type { FilterOption } from "@/components/shared/filters";
import { NativeSelect } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { useDetailUrl } from "@/features/reports/supplier-detail-tables";

// The filters of a history list, kept in the URL (the server pages and filters): dates and search applied on submit
// (Enter or Apply), selects at once. Every change goes back to page 1. Must sit inside DetailUrlProvider.

const fieldBox = "flex h-10 items-center gap-[9px] rounded-lg border bg-card pr-2 pl-[13px] focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/25";
const fieldInput = "h-full min-w-0 bg-transparent text-sm text-label outline-none placeholder:text-placeholder";
const caption = "shrink-0 text-[12.5px] text-muted-foreground";

export type SelectFilter = { param: string; label: string; options: FilterOption[] };

export function HistoryFilters({ searchLabel, placeholder, selects = [] }: { searchLabel: string; placeholder: string; selects?: SelectFilter[] }) {
  const { query, update } = useDetailUrl();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <form
        key={query.toString()}
        role="search"
        aria-label="History filters"
        className="flex flex-wrap items-center gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const value = (key: string) => String(data.get(key) ?? "").trim() || null;
          update({ q: value("q"), from: value("from"), to: value("to"), page: null });
        }}
      >
        <label className={`${fieldBox} w-[260px] max-sm:w-full`}>
          <span className={caption}>{searchLabel}</span>
          <input name="q" type="search" defaultValue={query.get("q") ?? ""} placeholder={placeholder} maxLength={100} className={`${fieldInput} flex-1`} />
        </label>
        <label className={fieldBox}>
          <span className={caption}>From</span>
          <input name="from" type="date" defaultValue={query.get("from") ?? ""} className={fieldInput} />
        </label>
        <label className={fieldBox}>
          <span className={caption}>To</span>
          <input name="to" type="date" defaultValue={query.get("to") ?? ""} className={fieldInput} />
        </label>
        <Button type="submit" variant="outline" className="h-10">
          Apply
        </Button>
        <Button type="button" variant="ghost" className="h-10" onClick={() => update({ q: null, from: null, to: null, page: null })}>
          Clear
        </Button>
      </form>
      {selects.map((select) => (
        <NativeSelect
          key={select.param}
          size="sm"
          aria-label={select.label}
          className="w-auto min-w-[170px]"
          value={query.get(select.param) ?? "all"}
          onChange={(event) => update({ [select.param]: event.target.value === "all" ? null : event.target.value, page: null })}
        >
          {select.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      ))}
    </div>
  );
}
