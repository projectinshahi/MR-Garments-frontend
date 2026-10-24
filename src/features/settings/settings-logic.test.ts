import { describe, expect, it } from "vitest";

import { suppliers } from "@/mocks/data/master";

import { supplierDraft } from "./data/fixtures";
import { addSupplier, filterRecords, supplierSchema } from "./settings-logic";

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
  it("requires a supplier name", () => {
    const result = supplierSchema.safeParse({ ...supplierDraft, name: "   " });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["name"]);
    expect(supplierSchema.parse(supplierDraft).name).toBe("Ningbo Denim Works");
  });

  it("appends the supplier as Active with no open orders", () => {
    const rows = addSupplier(suppliers, supplierSchema.parse(supplierDraft));
    expect(rows).toHaveLength(6);
    expect(suppliers).toHaveLength(5);
    expect(rows[5]).toEqual({
      id: "sup-new-6",
      name: "Ningbo Denim Works",
      contactPerson: "Mr. Xu Feng",
      phone: "+86 138 5740 9921",
      city: "Ningbo",
      currency: "CNY",
      openOrders: 0,
      status: "Active",
    });
    expect(new Set(addSupplier(rows, supplierDraft).map((row) => row.id)).size).toBe(7);
  });
});
