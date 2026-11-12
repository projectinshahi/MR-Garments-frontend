"use client";

import { Check, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type CurrencyChoice, currencyLabel, currencyOption, PREFERRED_CURRENCIES, searchCurrencies } from "@/lib/currencies";
import { cn } from "@/lib/utils";

/**
 * The searchable currency picker of the supplier form (backend docs/supplier-currency.md): a select-looking button
 * that opens a panel with a search box and the matching currencies, found by code, name or symbol, each shown as
 * "CNY – Chinese yuan (¥)". Arrow keys move, Enter picks, Escape closes; the preferred currencies come first while
 * nothing is typed, so nobody scrolls through 150 rows. The panel is at least 20rem wide (a narrow field would cut the
 * names) but never wider or taller than the screen, so it works on a phone. Orchestrator-owned.
 */
export function CurrencyCombobox({
  id,
  value,
  onChange,
  currencies,
  preferred = PREFERRED_CURRENCIES,
  invalid = false,
  disabled = false,
  placeholder = "Select currency",
}: {
  id: string;
  value: string;
  onChange: (code: string) => void;
  currencies: readonly CurrencyChoice[];
  preferred?: readonly string[];
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const results = useMemo(() => searchCurrencies(currencies, query, preferred), [currencies, query, preferred]);
  const selected = currencies.find((currency) => currency.code === value);
  const activeId = results[active] ? `${listId}-${results[active].code}` : undefined;

  // Opening starts a fresh search with the current value in view; typing starts from the first match.
  const openChange = (next: boolean) => {
    if (next) {
      setQuery("");
      setActive(Math.max(0, searchCurrencies(currencies, "", preferred).findIndex((currency) => currency.code === value)));
    }
    setOpen(next);
  };
  useEffect(() => {
    listRef.current?.querySelector(`[id="${activeId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!results.length) return;
      setActive((index) => (event.key === "ArrowDown" ? (index + 1) % results.length : (index - 1 + results.length) % results.length));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActive(event.key === "Home" ? 0 : Math.max(0, results.length - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const chosen = results[active];
      if (chosen) pick(chosen.code);
    }
    // Escape closes through the popover itself.
  };

  return (
    <Popover open={open} onOpenChange={openChange} modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={cn(
            "relative flex h-[42px] w-full items-center rounded-lg border border-input bg-input-background pr-9 pl-3 text-left text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/25 disabled:opacity-50 aria-invalid:border-destructive",
            !value && "text-placeholder",
          )}
        >
          {/* A saved code the loaded list lacks (the list failed to load) still shows: "CNY (¥)". */}
          <span className="truncate">{selected ? currencyOption(selected) : value ? currencyLabel(value) : placeholder}</span>
          <span aria-hidden className="pointer-events-none absolute top-1/2 right-[13px] -translate-y-1/2 text-[10px] text-foreground">
            ▼
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[max(var(--radix-popover-trigger-width),20rem)] max-w-[calc(100vw-2rem)] p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="flex items-center gap-2 border-b px-3">
          <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            role="searchbox"
            aria-label="Search currencies"
            aria-controls={listId}
            aria-activedescendant={activeId}
            autoComplete="off"
            spellCheck={false}
            placeholder="Search by code, name or symbol"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-placeholder"
          />
        </div>
        {results.length === 0 ? (
          <p role="status" className="px-3 py-3 text-sm text-muted-foreground">
            {currencies.length === 0 ? "The currency list could not be loaded. Close and try again." : `No currency matches “${query.trim()}”.`}
          </p>
        ) : (
          <ul ref={listRef} id={listId} role="listbox" aria-label="Currencies" className="max-h-[min(16rem,50dvh)] overflow-y-auto p-1">
            {results.map((currency, index) => {
              const isSelected = currency.code === value;
              return (
                <li
                  key={currency.code}
                  id={`${listId}-${currency.code}`}
                  role="option"
                  aria-label={currencyOption(currency)}
                  aria-selected={isSelected}
                  onMouseMove={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(currency.code)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm select-none",
                    index === active && "bg-info-soft text-primary",
                  )}
                >
                  <span className="w-11 shrink-0 font-bold">{currency.code}</span>
                  <span className="min-w-0 flex-1 truncate">{currency.name}</span>
                  <span className="shrink-0 text-muted-foreground">{currency.symbol}</span>
                  <Check aria-hidden className={cn("size-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
