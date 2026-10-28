import { describe, expect, it } from "vitest";

import type { DeliveryItem } from "@/lib/api/types";

import { toDelivery } from "./deliveries";
import { filterDeliveries, filterQuery, hrefWith, monthLinks, monthParam, readFilters, toParams, weekLinks, weekParam } from "./params";

const TODAY = "2026-10-27"; // a Tuesday
const q = (query: string) => new URLSearchParams(query);

const row = (po: string, supplier: string, due: string): DeliveryItem => ({
  orderId: `id-${po}`,
  po,
  supplier,
  item: "Ladies tops",
  quantity: 100,
  unit: "pcs",
  received: 0,
  due,
});

const deliveries = [
  row("PO-1", "Foshan Fabrics", "2026-10-20"),
  row("PO-2", "Yiwu Trims Ltd.", "2026-10-27"),
  row("PO-3", "Foshan Fabrics", "2026-11-03"),
  row("PO-4", "Foshan Fabrics", "2026-11-04"),
  row("PO-5", "Yiwu Trims Ltd.", "2026-11-26"),
  row("PO-6", "Foshan Fabrics", "2026-11-27"),
].map((r) => toDelivery(r, TODAY));
const pos = (list: typeof deliveries) => list.map((d) => d.po);

describe("period parameters", () => {
  it("shows the month in ?month=YYYY-MM, else today's month", () => {
    expect(monthParam(q("month=2026-12"), TODAY)).toBe("2026-12-01");
    expect(monthParam(q(""), TODAY)).toBe("2026-10-01");
    for (const bad of ["2026-13", "2026-1", "2026-12-05", "+002026-12", "december", ""]) {
      expect(monthParam(q(`month=${bad}`), TODAY)).toBe("2026-10-01");
    }
  });

  it("shows the Monday-first week holding ?week=YYYY-MM-DD, else today's week", () => {
    expect(weekParam(q("week=2026-11-02"), TODAY)).toBe("2026-11-02");
    expect(weekParam(q("week=2026-11-05"), TODAY)).toBe("2026-11-02"); // a Thursday shows its week
    expect(weekParam(q("week=2027-01-01"), TODAY)).toBe("2026-12-28"); // across the year end
    expect(weekParam(q(""), TODAY)).toBe("2026-10-26");
    for (const bad of ["2026-02-30", "2026-11", "2026-11-5", "soon"]) {
      expect(weekParam(q(`week=${bad}`), TODAY)).toBe("2026-10-26");
    }
  });

  it("reads repeated server parameters as the browser does (first value) and skips missing ones", () => {
    const params = toParams({ month: ["2026-12", "2027-01"], supplier: "Foshan Fabrics", week: undefined });
    expect(monthParam(params, TODAY)).toBe("2026-12-01");
    expect(params.get("supplier")).toBe("Foshan Fabrics");
    expect(params.has("week")).toBe(false);
  });
});

describe("previous, next and today links", () => {
  it("moves the month across year ends and keeps the filters", () => {
    expect(monthLinks(q("supplier=Foshan Fabrics"), "2026-12-01")).toEqual({
      previous: "/calendar?supplier=Foshan+Fabrics&month=2026-11",
      next: "/calendar?supplier=Foshan+Fabrics&month=2027-01",
      today: "/calendar?supplier=Foshan+Fabrics",
    });
    expect(monthLinks(q("month=2026-01"), "2026-01-01")).toMatchObject({ previous: "/calendar?month=2025-12", today: "/calendar" });
  });

  it("moves the week by seven days to the neighbouring Mondays", () => {
    expect(weekLinks(q("week=2026-12-28&range=next-7"), "2026-12-28")).toEqual({
      previous: "/calendar/week?week=2026-12-21&range=next-7",
      next: "/calendar/week?week=2027-01-04&range=next-7",
      today: "/calendar/week?range=next-7",
    });
  });

  it("sets or removes one parameter and drops an empty query", () => {
    expect(hrefWith("/calendar/list", q("supplier=A&range=next-7"), "range", null)).toBe("/calendar/list?supplier=A");
    expect(hrefWith("/calendar/list", q("supplier=A"), "supplier", null)).toBe("/calendar/list");
    expect(hrefWith("/calendar", q("supplier=A"), "supplier", "B")).toBe("/calendar?supplier=B");
  });

  it("carries only the filters, not the period, to the other tabs", () => {
    expect(filterQuery(q("month=2026-12&supplier=Foshan Fabrics&range=next-30&week=2026-11-02"))).toBe(
      "supplier=Foshan+Fabrics&range=next-30",
    );
    expect(filterQuery(q("month=2026-12"))).toBe("");
  });
});

describe("filters", () => {
  it("accepts a supplier present in CAL-1 and a known range; anything else is all", () => {
    expect(readFilters(q("supplier=Foshan Fabrics&range=next-7"), deliveries)).toEqual({ supplier: "Foshan Fabrics", range: "next-7" });
    expect(readFilters(q("supplier=Unknown Co.&range=next-90"), deliveries)).toEqual({ supplier: "all", range: "all" });
    expect(readFilters(q(""), deliveries)).toEqual({ supplier: "all", range: "all" });
  });

  it("keeps every delivery for all suppliers and all dates", () => {
    expect(filterDeliveries(deliveries, TODAY, "all")).toEqual(deliveries);
    expect(pos(filterDeliveries(deliveries, TODAY, "Yiwu Trims Ltd."))).toEqual(["PO-2", "PO-5"]);
  });

  it("limits a range to due dates from today to today + N days, inclusive, so late deliveries drop out", () => {
    expect(pos(filterDeliveries(deliveries, TODAY, "all", "next-7"))).toEqual(["PO-2", "PO-3"]);
    expect(pos(filterDeliveries(deliveries, TODAY, "all", "next-30"))).toEqual(["PO-2", "PO-3", "PO-4", "PO-5"]);
  });

  it("combines supplier and range, and returns nothing when none match", () => {
    expect(pos(filterDeliveries(deliveries, TODAY, "Foshan Fabrics", "next-30"))).toEqual(["PO-3", "PO-4"]);
    expect(filterDeliveries(deliveries, TODAY, "Yiwu Trims Ltd.", "next-7").map((d) => d.status)).toEqual(["due-soon"]);
    expect(filterDeliveries([], TODAY, "all", "next-7")).toEqual([]);
  });
});
