import { describe, expect, it } from "vitest";

import { compareCurrencies, currencyLabel, currencyName, currencyOption, currencySymbol, currencyTitle, minorUnits, orderedCurrencies, searchCurrencies } from "./currencies";

// Symbols, names and minor units for any ISO 4217 code, and the picker's search (backend docs/supplier-currency.md).

const CURRENCIES = [
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", minorUnits: 2 },
  { code: "USD", name: "US Dollar", symbol: "$", minorUnits: 2 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", minorUnits: 2 },
  { code: "AED", name: "United Arab Emirates Dirham", symbol: "AED", minorUnits: 2 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", minorUnits: 2 },
  { code: "EUR", name: "Euro", symbol: "€", minorUnits: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", minorUnits: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "JPY", minorUnits: 0 },
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR", minorUnits: 2 },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "KWD", minorUnits: 3 },
];

describe("symbols, names and minor units", () => {
  it("keeps ¥, $ and ₹ and the reference names for CNY, USD and INR", () => {
    expect([currencySymbol("CNY"), currencySymbol("USD"), currencySymbol("INR")]).toEqual(["¥", "$", "₹"]);
    expect([currencyTitle("CNY"), currencyTitle("USD"), currencyTitle("INR")]).toEqual(["¥ Chinese yuan", "$ US dollar", "₹ Indian rupee"]);
    expect(currencyLabel("USD")).toBe("USD ($)");
  });

  it("gives another currency its symbol, a longer form when it would clash with ¥, $ or ₹, or its code", () => {
    expect(currencySymbol("EUR")).toBe("€");
    expect(currencySymbol("GBP")).toBe("£");
    expect(currencySymbol("AUD")).toBe("A$");
    expect(currencySymbol("JPY")).toBe("JPY");
    expect(currencySymbol("AED")).toBe("AED");
    expect(currencySymbol("ZZZ")).toBe("ZZZ");
    expect(currencyName("AED")).toBe("United Arab Emirates Dirham");
    expect(currencyName("JPY")).toBe("Japanese Yen");
    expect(currencyName("ZZZ")).toBe("ZZZ");
    expect(currencyTitle("EUR")).toBe("€ Euro");
    expect(currencyOption(CURRENCIES[0]!)).toBe("CNY – Chinese Yuan (¥)");
  });

  it("knows the minor units: 2 for most, 0 for JPY, 3 for KWD, 2 for an unknown code", () => {
    expect([minorUnits("CNY"), minorUnits("JPY"), minorUnits("KWD"), minorUnits("ZZZ")]).toEqual([2, 0, 3, 2]);
  });

  it("orders CNY, USD, INR first and the rest by code", () => {
    expect(orderedCurrencies(["JPY", "INR", "AED", "USD", "CNY", "AED", "EUR"])).toEqual(["CNY", "USD", "INR", "AED", "EUR", "JPY"]);
    expect(["USD", "AED", "CNY"].sort(compareCurrencies)).toEqual(["CNY", "USD", "AED"]);
  });
});

describe("searchCurrencies", () => {
  const codes = (query: string) => searchCurrencies(CURRENCIES, query).map((currency) => currency.code);

  it("lists the preferred currencies first and the rest by code while nothing is typed", () => {
    expect(codes("")).toEqual(["CNY", "USD", "INR", "AED", "AUD", "EUR", "GBP", "JPY", "KWD", "SAR"]);
    expect(codes("   ")).toEqual(codes(""));
  });

  it("finds a currency by code, by name and by symbol, case-insensitively, best matches first", () => {
    expect(codes("jp")).toEqual(["JPY"]);
    expect(codes("JPY")).toEqual(["JPY"]);
    expect(codes("dirham")).toEqual(["AED"]);
    expect(codes("Euro")).toEqual(["EUR"]);
    expect(codes("€")).toEqual(["EUR"]);
    // "$" is the dollar: USD itself first, then the dollars whose symbol contains it.
    expect(codes("$")).toEqual(["USD", "AUD"]);
    // A code match outranks a name match: "in" starts INR's code, and is only inside "Chinese" and "Dinar".
    expect(codes("in")).toEqual(["INR", "CNY", "KWD"]);
    expect(codes("dollar")).toEqual(["USD", "AUD"]);
    // ISO's own name is searched as well.
    expect(searchCurrencies([...CURRENCIES, { code: "XCD", name: "East Caribbean Dollar", isoName: "East Caribbean Dollar", symbol: "EC$" }], "caribbean").map((c) => c.code)).toEqual(["XCD"]);
    expect(searchCurrencies([{ code: "AED", name: "United Arab Emirates Dirham", isoName: "UAE Dirham", symbol: "AED" }], "uae").map((c) => c.code)).toEqual(["AED"]);
  });

  it("returns nothing for text no currency has", () => {
    expect(codes("zzz")).toEqual([]);
    expect(codes("rupiah")).toEqual([]);
  });
});
