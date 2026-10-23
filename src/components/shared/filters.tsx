"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string; /** "danger" colors the label (e.g. "Late 3"). */ tone?: "danger" };

/**
 * Pill toggle group ("All 50 · Late 3 · Due soon 5"): active = navy. variant="segmented" is the boxed
 * control on Landed Cost (By order / By team / By item). Labels include their counts as shown.
 */
export function FilterChips({
  options,
  value,
  onValueChange,
  label,
  variant = "chips",
  className,
}: {
  options: FilterOption[];
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible name of the group. */
  label: string;
  variant?: "chips" | "segmented";
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(variant === "chips" ? "flex flex-wrap gap-2" : "inline-flex rounded-lg border bg-card p-px", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "text-sm font-bold whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
              variant === "chips" ? "h-[33px] rounded-full border px-3" : "h-[30px] rounded-[7px] px-[18px]",
              active
                ? "border-navy bg-navy text-white"
                : cn("bg-card hover:bg-neutral-soft", option.tone === "danger" ? "text-danger" : "text-foreground"),
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Dropdown filter button: "Stage  All stages ▾" (inline label) or "All suppliers ▾". The trigger is a plain
 * button, so it renders identically before hydration.
 */
export function FilterSelect({
  label,
  showLabel = false,
  value,
  options,
  onValueChange,
  className,
}: {
  /** Accessible name; shown inline in small muted text when showLabel is set. */
  label: string;
  showLabel?: boolean;
  value: string;
  options: FilterOption[];
  onValueChange: (value: string) => void;
  className?: string;
}) {
  const current = options.find((o) => o.value === value)?.label ?? value;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label}: ${current}`}
        className={cn(
          "inline-flex h-10 shrink-0 items-center gap-[9px] rounded-lg border bg-card px-[15px] text-[15px] text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          className,
        )}
      >
        {showLabel ? <span className="text-xs text-muted-foreground">{label}</span> : null}
        <span>
          {current} <span aria-hidden>▾</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Search field without an icon. inlineLabel renders the small "Search" prefix used on settings and users. */
export function SearchInput({
  label,
  inlineLabel,
  value,
  onValueChange,
  placeholder,
  className,
}: {
  /** Accessible name. */
  label: string;
  inlineLabel?: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex h-10 items-center gap-[11px] rounded-lg border bg-input-background px-3.5 focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/25",
        className,
      )}
    >
      {inlineLabel ? (
        <span aria-hidden className="text-xs text-muted-foreground">
          {inlineLabel}
        </span>
      ) : null}
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-placeholder"
      />
    </label>
  );
}
