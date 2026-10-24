import { describe, expect, it } from "vitest";

import { getCalendar } from "./data/queries";
import { deliveriesPerDay, dueOn, isoDay, lateBy, monthWeeks, supplierOptions, weekDays } from "./deliveries";

describe("calendar derivations", () => {
  it("builds five Monday-first weeks for October 2026, 28 Sep to 1 Nov", () => {
    const weeks = monthWeeks("2026-10-01");
    expect(weeks).toHaveLength(5);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(isoDay(weeks[0][0])).toBe("2026-09-28");
    expect(isoDay(weeks[4][6])).toBe("2026-11-01");
  });

  it("uses the week of 30 Sep: Mon 28 Sep to Sun 4 Oct", () => {
    expect(weekDays().map(isoDay)).toEqual([
      "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
    ]);
  });

  it("reproduces the deliveries-per-day chart and the late pills", async () => {
    const { deliveries } = await getCalendar();
    expect(deliveriesPerDay(deliveries)).toEqual([
      { label: "Thu 1", value: 2 },
      { label: "Fri 2", value: 1 },
      { label: "Sat 3", value: 2 },
      { label: "Sun 4", value: 0 },
      { label: "Mon 5", value: 1 },
      { label: "Tue 6", value: 1 },
      { label: "Wed 7", value: 1 },
    ]);
    expect(deliveries.filter((d) => d.status === "late").map((d) => lateBy(d.due))).toEqual(["4 days", "3 days", "1 day"]);
    expect(dueOn(deliveries, new Date(2026, 9, 20)).map((d) => d.po)).toEqual(["PO-2060", "PO-2061"]);
  });

  it("lists every supplier once after All suppliers", async () => {
    const { deliveries } = await getCalendar();
    expect(supplierOptions(deliveries).map((o) => o.label)).toEqual([
      "All suppliers", "Foshan Fabrics", "Guangzhou Textile Co.", "Hangzhou Knits", "Shenzhen Apparel", "Yiwu Trims Ltd.",
    ]);
  });
});
