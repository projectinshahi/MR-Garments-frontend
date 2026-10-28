import { describe, expect, it } from "vitest";

import { suppliers } from "@/mocks/data/master";

import { supplierDraft } from "./data/fixtures";
import { averagePerPieceText, filterRecords, perBundleText, supplierSchema } from "./settings-logic";

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
    name: "Ningbo Denim Works",
    city: "Ningbo",
    contactPerson: "Mr. Xu Feng",
    phone: "+86 138 5740 9921",
    currency: "CNY" as const,
    address: "",
    notes: "",
  };

  it("opens empty with yuan selected, and requires a supplier name", () => {
    expect(supplierDraft).toEqual({ name: "", city: "", contactPerson: "", phone: "", currency: "CNY", address: "", notes: "" });
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
  });
});

describe("read-only tab cells", () => {
  it("shows the team average per piece, or – while the team has no stock (B6.2)", () => {
    expect(averagePerPieceText(null)).toBe("–");
    expect(averagePerPieceText(282.51)).toBe("₹282.51");
    expect(averagePerPieceText(0)).toBe("₹0.00");
  });

  it("shows the bundle label when set, otherwise the pieces per bundle", () => {
    expect(perBundleText({ perBundle: 50, bundleLabel: null })).toBe("50");
    expect(perBundleText({ perBundle: 1200, bundleLabel: null })).toBe("1,200");
    expect(perBundleText({ perBundle: null, bundleLabel: "Roll" })).toBe("Roll");
  });
});
