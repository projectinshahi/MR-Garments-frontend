import { describe, expect, it } from "vitest";

import { suppliers } from "@/mocks/data/master";

import { supplierDraft } from "./data/fixtures";
import { averagePerPieceText, exchangeRateProblem, exchangeRateText, filterRecords, itemPriceText, supplierSchema, toSupplierBody } from "./settings-logic";

const search = (row: { name: string; contactPerson: string; phone: string }) => [row.name, row.contactPerson, row.phone];
const names = (rows: { name: string }[]) => rows.map((row) => row.name);

describe("filterRecords", () => {
  it("shows every active record by default and none for Inactive", () => {
    expect(filterRecords(suppliers, { query: "", status: "Active" }, search)).toHaveLength(5);
    expect(filterRecords(suppliers, { query: "", status: "Inactive" }, search)).toEqual([]);
    expect(filterRecords(suppliers, { query: "", status: "All" }, search)).toHaveLength(5);
  });

  it("matches the name, contact or phone, ignoring case and spaces", () => {
    expect(names(filterRecords(suppliers, { query: "YIWU", status: "All" }, search))).toEqual(["Yiwu Trims Ltd."]);
    expect(names(filterRecords(suppliers, { query: "liu yan", status: "All" }, search))).toEqual(["Shenzhen Apparel"]);
    expect(names(filterRecords(suppliers, { query: "+861372288", status: "All" }, search))).toEqual(["Foshan Fabrics"]);
    expect(filterRecords(suppliers, { query: "ningbo", status: "All" }, search)).toEqual([]);
  });

  it("applies the status chip together with the search", () => {
    const inactive = { ...suppliers[0], id: "x", status: "Inactive" as const };
    const rows = [...suppliers, inactive];
    expect(filterRecords(rows, { query: "guangzhou", status: "Active" }, search)).toHaveLength(1);
    expect(filterRecords(rows, { query: "guangzhou", status: "Inactive" }, search)).toEqual([inactive]);
    expect(filterRecords(rows, { query: "guangzhou", status: "All" }, search)).toHaveLength(2);
  });
});

describe("add supplier", () => {
  const ningbo = {
    code: "SUP-006",
    name: "Ningbo Denim Works",
    country: "China",
    city: "Ningbo",
    state: "",
    postalCode: "",
    contactPerson: "Mr. Xu Feng",
    email: "",
    phone: "+86 138 5740 9921",
    currency: "CNY" as const,
    exchangeRate: "11.5",
    address: "",
    paymentTerms: "",
    taxNumber: "",
    notes: "",
  };

  it("opens empty with yuan selected, and requires a supplier name", () => {
    expect(supplierDraft).toEqual({
      code: "",
      name: "",
      country: "",
      city: "",
      state: "",
      postalCode: "",
      contactPerson: "",
      email: "",
      phone: "",
      currency: "CNY",
      exchangeRate: "",
      address: "",
      paymentTerms: "",
      taxNumber: "",
      notes: "",
    });
    for (const name of ["", "   "]) {
      const result = supplierSchema.safeParse({ ...ningbo, name });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]).toMatchObject({ path: ["name"], message: "Enter the supplier name." });
    }
    expect(supplierSchema.parse(ningbo).name).toBe("Ningbo Denim Works");
  });

  it("produces exactly the MD-2 body, trimmed", () => {
    expect(supplierSchema.parse({ ...ningbo, name: " Ningbo Denim Works ", notes: " Denim only " })).toEqual({
      ...ningbo,
      notes: "Denim only",
    });
    expect(toSupplierBody(supplierSchema.parse(ningbo))).toEqual({ ...ningbo, exchangeRate: 11.5 });
  });

  // docs/supplier-currency.md: the rate is INR per 1 unit of the currency; INR is the base currency, so its rate is 1.
  it("requires the exchange rate above 0 with at most 4 decimals unless the currency is INR, whose rate is 1", () => {
    const message = "Enter the exchange rate: INR per 1 unit, above 0, with at most 4 decimals.";
    for (const rate of ["", "0", "0.0000", "-1", "abc", "12.12345", "1e3"]) expect(exchangeRateProblem("CNY", rate), rate).toBe(message);
    for (const rate of ["1", "11.5", "88.2500", "0.0001", "99999999"]) expect(exchangeRateProblem("USD", rate), rate).toBeNull();
    for (const rate of ["", "0", "anything"]) expect(exchangeRateProblem("INR", rate), rate).toBeNull();
    const problems = supplierSchema.safeParse({ ...ningbo, exchangeRate: "" }).error?.issues.map((issue) => `${String(issue.path[0])}: ${issue.message}`);
    expect(problems).toEqual([`exchangeRate: ${message}`]);
    expect(supplierSchema.safeParse({ ...ningbo, currency: "INR", exchangeRate: "" }).success).toBe(true);
    expect(toSupplierBody({ ...ningbo, currency: "INR", exchangeRate: "" })).toMatchObject({ currency: "INR", exchangeRate: 1 });
    expect(toSupplierBody({ ...ningbo, currency: "USD", exchangeRate: "88.25" })).toMatchObject({ currency: "USD", exchangeRate: 88.25 });
  });

  it("writes the list's Exchange rate cell: ₹ per unit, 1.00 for INR, Not set without one", () => {
    expect(exchangeRateText("CNY", 11.5)).toBe("₹11.50");
    expect(exchangeRateText("USD", 88.2525)).toBe("₹88.2525");
    expect(exchangeRateText("INR", 1)).toBe("1.00");
    expect(exchangeRateText("CNY", null)).toBe("Not set");
  });
});

describe("read-only tab cells", () => {
  it("shows the team average per piece, or – while the team has no stock (B6.2)", () => {
    expect(averagePerPieceText(null)).toBe("–");
    expect(averagePerPieceText(282.51)).toBe("₹282.51");
    expect(averagePerPieceText(0)).toBe("₹0.00");
  });

  it("shows the item price to 2 decimals, or – while none is set", () => {
    expect(itemPriceText(null)).toBe("–");
    expect(itemPriceText(50)).toBe("50.00");
    expect(itemPriceText(1250.5)).toBe("1,250.50");
    expect(itemPriceText(0)).toBe("0.00");
    // An older API without the field: a dash, never NaN.
    expect(itemPriceText(undefined)).toBe("–");
  });
});
