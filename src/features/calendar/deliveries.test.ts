import { describe, expect, it } from "vitest";

import type { DeliveryItem } from "@/lib/api/types";

import { deliveriesPerDay, dueOn, isoDay, lateBy, monthWeeks, supplierOptions, toDelivery, weekDays } from "./deliveries";

const TODAY = "2026-09-30";

const row = (po: string, supplier: string, due: string): DeliveryItem => ({
  orderId: `id-${po}`,
  po,
  supplier,
  item: "Ladies tops",
  quantity: 2_000,
  unit: "pcs",
  received: 0,
  due,
});

const rows = [
  row("PO-2041", "Guangzhou Textile Co.", "2026-09-26"),
  row("PO-2044", "Shenzhen Apparel", "2026-09-29"),
  row("PO-2040", "Foshan Fabrics", "2026-09-30"),
  row("PO-2047", "Guangzhou Textile Co.", "2026-10-01"),
  row("PO-2053", "Yiwu Trims Ltd.", "2026-10-01"),
  row("PO-2049", "Foshan Fabrics", "2026-10-07"),
  row("PO-2058", "Foshan Fabrics", "2026-10-08"),
];
const deliveries = rows.map((r) => toDelivery(r, TODAY));

describe("calendar derivations", () => {
  it("maps API rows to statuses and labels against today: late, due within 7 days, on track", () => {
    expect(deliveries.map((d) => [d.po, d.status, d.statusLabel])).toEqual([
      ["PO-2041", "late", "4 days late"],
      ["PO-2044", "late", "1 day late"],
      ["PO-2040", "due-soon", "Due today"],
      ["PO-2047", "due-soon", "Due in 1 day"],
      ["PO-2053", "due-soon", "Due in 1 day"],
      ["PO-2049", "due-soon", "Due in 7 days"],
      ["PO-2058", "on-track", "On track"],
    ]);
    expect(deliveries[0]).toEqual({
      po: "PO-2041",
      supplier: "Guangzhou Textile Co.",
      item: "Ladies tops",
      quantity: 2_000,
      unit: "pcs",
      due: "2026-09-26",
      status: "late",
      statusLabel: "4 days late",
    });
  });

  it("builds five Monday-first weeks for October 2026, 28 Sep to 1 Nov", () => {
    const weeks = monthWeeks("2026-10-01");
    expect(weeks).toHaveLength(5);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(isoDay(weeks[0][0])).toBe("2026-09-28");
    expect(isoDay(weeks[4][6])).toBe("2026-11-01");
  });

  it("uses the week of today, Monday to Sunday", () => {
    expect(weekDays(TODAY).map(isoDay)).toEqual([
      "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
    ]);
    expect(isoDay(weekDays("2026-10-27")[0])).toBe("2026-10-26");
  });

  it("counts deliveries per day for the 7 days after today and how late each one is", () => {
    expect(deliveriesPerDay(deliveries, TODAY)).toEqual([
      { label: "Thu 1", value: 2 },
      { label: "Fri 2", value: 0 },
      { label: "Sat 3", value: 0 },
      { label: "Sun 4", value: 0 },
      { label: "Mon 5", value: 0 },
      { label: "Tue 6", value: 0 },
      { label: "Wed 7", value: 1 },
    ]);
    expect(lateBy("2026-09-26", TODAY)).toBe("4 days");
    expect(lateBy("2026-09-29", TODAY)).toBe("1 day");
    expect(dueOn(deliveries, new Date(2026, 9, 1)).map((d) => d.po)).toEqual(["PO-2047", "PO-2053"]);
  });

  it("gives seven empty days and only All suppliers when there are no deliveries", () => {
    expect(deliveriesPerDay([], TODAY).every((d) => d.value === 0)).toBe(true);
    expect(supplierOptions([])).toEqual([{ value: "all", label: "All suppliers" }]);
  });

  it("lists every supplier once after All suppliers", () => {
    expect(supplierOptions(deliveries).map((o) => o.label)).toEqual([
      "All suppliers", "Foshan Fabrics", "Guangzhou Textile Co.", "Shenzhen Apparel", "Yiwu Trims Ltd.",
    ]);
  });
});
