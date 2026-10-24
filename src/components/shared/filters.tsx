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
 * size="sm" (chips): 32 px pills with 13 px bold slate text, as in the list filters (05, 20, 22).
 */
export function FilterChips({
  options,
  value,
  onValueChange,
  label,
  variant = "chips",
  size = "default",
  className,
}: {
  options: FilterOption[];
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible name of the group. */
  label: string;
  variant?: "chips" | "segmented";
  size?: "default" | "sm";
  className?: string;
}) {
  const sm = size === "sm" && variant === "chips";
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
              sm ? "text-[13px]" : "text-sm",
              "font-bold whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
              variant === "chips"
                ? cn("rounded-full border", sm ? "h-8 px-3.5" : "h-[33px] px-3")
                : "h-[30px] rounded-[7px] px-[18px]",
              active
                ? "border-navy bg-navy text-white"
                : cn(
                    "bg-card hover:bg-neutral-soft",
                    option.tone === "danger" ? "text-danger" : sm ? "text-label" : "text-foreground",
                  ),
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
 * size="sm": 14 px slate value with a solid 6 × 5 triangle 5 px after it, as in the list filters (05, 20, 22).
 */
export function FilterSelect({
  label,
  showLabel = false,
  value,
  options,
  onValueChange,
  size = "default",
  className,
}: {
  /** Accessible name; shown inline in small muted text when showLabel is set. */
  label: string;
  showLabel?: boolean;
  value: string;
  options: FilterOption[];
  onValueChange: (value: string) => void;
  size?: "default" | "sm";
  className?: string;
}) {
  const current = options.find((o) => o.value === value)?.label ?? value;
  const sm = size === "sm";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label}: ${current}`}
        className={cn(
          "inline-flex h-10 shrink-0 items-center gap-[9px] rounded-lg border bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          sm ? "pr-3.5 pl-[15px] text-sm text-label" : "px-[15px] text-[15px] text-foreground",
          className,
        )}
      >
        {showLabel ? <span className="text-xs text-muted-foreground">{label}</span> : null}
        {sm ? (
          <span className="inline-flex items-center gap-[5px]">
            {current}
            <svg aria-hidden viewBox="0 0 6 5" className="h-[5px] w-1.5 fill-current">
              <path d="M0 0h6L3 5z" />
            </svg>
          </span>
        ) : (
          <span>
            {current} <span aria-hidden>▾</span>
          </span>
        )}
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

/**
 * Search field without an icon. inlineLabel renders the small "Search" prefix used on settings and users.
 * size: default 40 px with 15 px text; sm 38 px with 13.5 px text (the dashboard header search).
 */
export function SearchInput({
  label,
  inlineLabel,
  value,
  onValueChange,
  placeholder,
  size = "default",
  className,
}: {
  /** Accessible name. */
  label: string;
  inlineLabel?: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  size?: "default" | "sm";
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-[11px] rounded-lg border bg-input-background px-3.5 focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/25",
        size === "sm" ? "h-[38px]" : "h-10",
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
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-placeholder",
          size === "sm" ? "text-[13.5px]" : "text-[15px]",
        )}
      />
    </label>
  );
}
