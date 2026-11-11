import { describe, expect, it } from "vitest";

import { suggestSupplierCode, supplierSchema } from "@/features/settings/settings-logic";
import type { SupplierRow } from "@/lib/api/types";

import { countryCode } from "./countries";
import { countryOptions, daysText, filterSuppliers, moneyText, rateText } from "./suppliers-logic";

const row = (over: Partial<SupplierRow>): SupplierRow => ({
  id: "s",
  code: "SUP-001",
  name: "Guangzhou Textile Co.",
  contactPerson: "",
  phone: "",
  email: "",
  country: "China",
  city: "",
  state: "",
  postalCode: "",
  address: "",
  paymentTerms: "",
  taxNumber: "",
  notes: "",
  currency: "CNY",
  openOrders: 0,
  openPos: 0,
  ytdValue: [],
  balance: [],
  exchangeRate: null,
  rateUpdatedAt: null,
  hasTransactions: false,
  status: "Active",
  ...over,
});
const rows = [
  row({ id: "a" }),
  row({ id: "b", code: "SUP-002", name: "Dhaka Knits", country: "Bangladesh" }),
  row({ id: "c", code: "VN-7", name: "Hanoi Threads", country: "Vietnam", status: "Inactive" }),
  row({ id: "d", code: "SUP-004", name: "No Country", country: "" }),
];
const names = (list: SupplierRow[]) => list.map((r) => r.name);

describe("filterSuppliers", () => {
  it("searches name, code and country ignoring case and spaces, within the status chip and the country", () => {
    expect(names(filterSuppliers(rows, { query: "sup-00", status: "All", country: "all" }))).toEqual(["Guangzhou Textile Co.", "Dhaka Knits", "No Country"]);
    expect(names(filterSuppliers(rows, { query: "viet nam", status: "All", country: "all" }))).toEqual(["Hanoi Threads"]);
    expect(names(filterSuppliers(rows, { query: "viet nam", status: "Active", country: "all" }))).toEqual([]);
    expect(names(filterSuppliers(rows, { query: "", status: "Active", country: "Bangladesh" }))).toEqual(["Dhaka Knits"]);
    expect(names(filterSuppliers(rows, { query: "", status: "All", country: "" }))).toEqual(["No Country"]);
  });

  it("offers every country once, A to Z, with a Not set entry for an empty one", () => {
    expect(countryOptions(rows)).toEqual([
      { value: "all", label: "All countries" },
      { value: "", label: "Not set" },
      { value: "Bangladesh", label: "Bangladesh" },
      { value: "China", label: "China" },
      { value: "Vietnam", label: "Vietnam" },
    ]);
  });
});

describe("labels", () => {
  it("prints money per currency, rates and days, with a dash for nothing", () => {
    expect(moneyText([])).toBe("–");
    expect(moneyText([{ currency: "CNY", amount: 5800 }, { currency: "USD", amount: 200 }])).toBe("¥5,800 · $200");
    expect(rateText(null)).toBe("–");
    expect(rateText(92)).toBe("92%");
    expect(daysText(null)).toBe("–");
    expect(daysText(1)).toBe("1 day");
    expect(daysText(25)).toBe("25 days");
  });

  it("gives the ISO code badge of the countries in the list and nothing else", () => {
    expect(countryCode("China")).toBe("CN");
    expect(countryCode("India")).toBe("IN");
    expect(countryCode("Atlantis")).toBe("");
    expect(countryCode("")).toBe("");
  });
});

describe("supplier form rules", () => {
  it("offers the next SUP-nnn code after the highest in the list, ignoring other shapes", () => {
    expect(suggestSupplierCode([])).toBe("SUP-001");
    expect(suggestSupplierCode(rows)).toBe("SUP-005");
    expect(suggestSupplierCode([row({ code: "SUP-999" }), row({ code: "ABC-5000" })])).toBe("SUP-1000");
  });

  it("upper-cases the code and checks the code, email and phone shapes", () => {
    const base = { name: "Ningbo Denim Works", country: "", city: "", state: "", postalCode: "", contactPerson: "", email: "", phone: "", currency: "CNY" as const, exchangeRate: "11.5", address: "", paymentTerms: "", taxNumber: "", notes: "" };
    expect(supplierSchema.parse({ ...base, code: " nb-01 " }).code).toBe("NB-01");
    const problems = (values: object) => supplierSchema.safeParse(values).error?.issues.map((issue) => `${String(issue.path[0])}: ${issue.message}`);
    expect(problems({ ...base, code: "" })).toEqual(["code: Use up to 20 letters, digits or dashes."]);
    expect(problems({ ...base, code: "SUP 1" })).toEqual(["code: Use up to 20 letters, digits or dashes."]);
    expect(problems({ ...base, code: "SUP-1", email: "nope" })).toEqual(["email: Enter a valid email address."]);
    expect(problems({ ...base, code: "SUP-1", phone: "call me" })).toEqual(["phone: Enter a valid phone number."]);
    expect(problems({ ...base, code: "SUP-1", phone: "1234" })).toEqual(["phone: Enter a valid phone number."]);
    // Letters around the digits are fine (older "Phone / WeChat" values keep saving).
    expect(problems({ ...base, code: "SUP-1", phone: "WeChat 13800132244" })).toBeUndefined();
    expect(problems({ ...base, code: "SUP-1", email: "a@b.co", phone: "+86 138 0013 2244" })).toBeUndefined();
  });
});
