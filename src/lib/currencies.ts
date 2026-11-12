import type { Currency } from "@/types/domain";

// Currency names, symbols and minor units for any ISO 4217 code (backend docs/supplier-currency.md). The list of codes
// a supplier may use is the backend's master (GET /currencies, loaded by the pages that open the supplier dialog);
// symbols and names here come from the same CLDR data through Intl, with the same rule the master is generated with,
// so an amount formats the same on both sides. No currency list lives in this repository.

/** CNY, USD and INR: first in every per-currency list and total, as the references order them. */
export const PREFERRED_CURRENCIES = ["CNY", "USD", "INR"] as const;
/** The three keep the symbols the references draw; another currency sharing one gets its longer form ("A$") or its code. */
const RESERVED: Record<string, string> = { CNY: "¥", USD: "$", INR: "₹" };
/** The three names as the screens always wrote them (order terms, supplier dialog); every other name is CLDR's. */
const KNOWN_NAMES: Record<string, string> = { CNY: "Chinese yuan", USD: "US dollar", INR: "Indian rupee" };

const isCode = (code: string) => /^[A-Z]{3}$/.test(code);
const partOf = (code: string, currencyDisplay: "narrowSymbol" | "symbol") => {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: code, currencyDisplay }).formatToParts(1).find((part) => part.type === "currency")?.value ?? code;
  } catch {
    return code;
  }
};

const symbols = new Map<string, string>();
/** "¥", "$", "₹", "€", "A$"; the code itself for a currency without a symbol ("AED") or an unknown code. */
export function currencySymbol(code: Currency): string {
  const cached = symbols.get(code);
  if (cached) return cached;
  const symbol = (() => {
    if (RESERVED[code]) return RESERVED[code];
    if (!isCode(code)) return code;
    const taken = new Set(Object.values(RESERVED));
    const narrow = partOf(code, "narrowSymbol");
    if (!taken.has(narrow)) return narrow;
    const long = partOf(code, "symbol");
    return taken.has(long) ? code : long;
  })();
  symbols.set(code, symbol);
  return symbol;
}

let displayNames: Intl.DisplayNames | null | undefined;
/** "Chinese yuan", "United Arab Emirates Dirham"; the code when nothing better is known. */
export function currencyName(code: Currency): string {
  if (KNOWN_NAMES[code]) return KNOWN_NAMES[code];
  if (!isCode(code)) return code;
  try {
    displayNames ??= new Intl.DisplayNames(["en"], { type: "currency" });
    return displayNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** "¥ Chinese yuan": the symbol and the name, as the order terms and the supplier pages show a currency. */
export const currencyTitle = (code: Currency) => `${currencySymbol(code)} ${currencyName(code)}`;
/** "CNY (¥)": a currency as a read-only field or a select option shows it. */
export const currencyLabel = (code: Currency) => `${code} (${currencySymbol(code)})`;
/** "CNY – Chinese yuan (¥)": a row of the searchable picker. */
export const currencyOption = (currency: { code: string; name: string; symbol: string }) => `${currency.code} – ${currency.name} (${currency.symbol})`;

const units = new Map<string, number>();
/** Decimal places of the currency's minor unit (JPY 0, KWD 3, most 2): the most an amount shows. */
export function minorUnits(code: Currency): number {
  const cached = units.get(code);
  if (cached !== undefined) return cached;
  let digits = 2;
  if (isCode(code)) {
    try {
      digits = new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
      digits = 2;
    }
  }
  units.set(code, digits);
  return digits;
}

const rank = (code: string) => {
  const index = (PREFERRED_CURRENCIES as readonly string[]).indexOf(code);
  return index === -1 ? PREFERRED_CURRENCIES.length : index;
};
/** CNY, USD, INR, then the rest by code: the order of every per-currency list and total (the API's too). */
export const compareCurrencies = (a: Currency, b: Currency) => rank(a) - rank(b) || a.localeCompare(b);
/** The distinct codes of `codes` in compareCurrencies order. */
export const orderedCurrencies = (codes: Iterable<Currency>): Currency[] => [...new Set(codes)].sort(compareCurrencies);

/** What the picker shows and searches of a currency of the master (GET /currencies). */
export type CurrencyChoice = { code: string; name: string; symbol: string; /** ISO's own name ("UAE Dirham", "Yuan Renminbi"). */ isoName?: string };

/**
 * The picker's rows for `query`: with nothing typed, the preferred currencies then the rest by code; otherwise every
 * currency whose code, name (CLDR's or ISO's: "UAE", "Renminbi", "Sterling") or symbol contains the text
 * (case-insensitive), the best matches first: a code that starts with it, then a name that does, then the symbol
 * itself, then any other match.
 */
export function searchCurrencies<T extends CurrencyChoice>(currencies: readonly T[], query: string, preferred: readonly string[] = PREFERRED_CURRENCIES): T[] {
  const text = query.trim().toLowerCase();
  const preferredRank = (code: string) => {
    const index = preferred.indexOf(code);
    return index === -1 ? preferred.length : index;
  };
  const byPreference = (a: T, b: T) => preferredRank(a.code) - preferredRank(b.code) || a.code.localeCompare(b.code);
  if (!text) return [...currencies].sort(byPreference);
  const score = (currency: T) => {
    const code = currency.code.toLowerCase();
    const names = [currency.name, currency.isoName ?? ""].map((name) => name.toLowerCase());
    const symbol = currency.symbol.toLowerCase();
    if (code.startsWith(text)) return 0;
    if (names.some((name) => name.startsWith(text))) return 1;
    if (symbol === text) return 2;
    if (code.includes(text) || names.some((name) => name.includes(text)) || symbol.includes(text)) return 3;
    return -1;
  };
  return currencies
    .map((currency) => ({ currency, score: score(currency) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => a.score - b.score || byPreference(a.currency, b.currency))
    .map((entry) => entry.currency);
}
