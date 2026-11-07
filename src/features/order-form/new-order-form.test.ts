import { describe, expect, it } from "vitest";

import { orderHref } from "@/components/shared/po-link";

import { emptyLine, newOrderSchema, toCreateOrderBody } from "./new-order-form";

const valid = {
  po: "PO-2050",
  supplierId: "s-1",
  currency: "CNY" as const,
  orderDate: "2026-11-01",
  deliveryDate: "2026-11-20",
  lines: [{ itemId: "i-1", rateCny: "12.5", quantity: "200" }, emptyLine()],
  deposits: [],
};
const poError = (po: string) => newOrderSchema.safeParse({ ...valid, po }).error?.issues.find((issue) => issue.path[0] === "po")?.message;

describe("PO number", () => {
  it("takes any format, trimmed and kept as typed", () => {
    for (const po of ["PO-2050", "VM-11340", "MR/2026/001", "ABC-001", "2026-001", "SUPPLIER/PO/2026/01", "mr-001"]) {
      expect(poError(po), po).toBeUndefined();
      expect(toCreateOrderBody(newOrderSchema.parse({ ...valid, po: `  ${po} ` }), { suppliers: [], agents: [] }).po).toBe(po);
    }
  });

  it("must not be blank or longer than 50 characters", () => {
    expect(poError("")).toBe("Enter the PO number.");
    expect(poError("   ")).toBe("Enter the PO number.");
    expect(poError("x".repeat(51))).toBe("Use 50 characters or fewer.");
    expect(poError("x".repeat(50))).toBeUndefined();
  });

  it("travels in a URL encoded, so a slash stays inside the PO", () => {
    expect(orderHref("PO-2050")).toBe("/orders/PO-2050");
    expect(orderHref("MR/2026/001")).toBe("/orders/MR%2F2026%2F001");
    expect(orderHref("A B&C")).toBe("/orders/A%20B%26C");
  });
});
