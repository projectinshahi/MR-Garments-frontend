import { describe, expect, it } from "vitest";

import { getNotifications } from "./data/queries";
import { filterNotifications, isNotificationFilter, notificationFilterOptions } from "./notification-filter";

describe("notification filter chips", () => {
  it("labels the chips as in the reference, with the unread count", async () => {
    const { items } = await getNotifications();
    expect(notificationFilterOptions(items).map((o) => o.label)).toEqual([
      "All",
      "Unread (3)",
      "Late deliveries",
      "Payments",
      "Containers",
    ]);
  });

  it("counts unread from the data", async () => {
    const { items } = await getNotifications();
    const oneRead = items.map((item, i) => (i === 0 ? { ...item, unread: false } : item));
    expect(notificationFilterOptions(oneRead)[1].label).toBe("Unread (2)");
  });

  it("accepts only chip values", () => {
    expect(isNotificationFilter("unread")).toBe(true);
    expect(isNotificationFilter("short-receipt")).toBe(false);
  });
});

describe("filterNotifications", () => {
  it("keeps all seven rows, newest first, for All", async () => {
    const { items } = await getNotifications();
    const all = filterNotifications(items, "all");
    expect(all).toHaveLength(7);
    expect(all[0].title).toBe("PO-2044 delivery is 1 day late");
    expect(all[6].title).toBe("PO-2041 delivery is 4 days late");
  });

  it("filters unread rows and each category", async () => {
    const { items } = await getNotifications();
    const titles = (filter: Parameters<typeof filterNotifications>[1]) => filterNotifications(items, filter).map((n) => n.title);

    expect(titles("unread")).toEqual([
      "PO-2044 delivery is 1 day late",
      "PO-2047 and PO-2053 are due tomorrow (1 Oct)",
      "Payment due in 5 days: PO-2041",
    ]);
    expect(titles("late-delivery")).toEqual(["PO-2044 delivery is 1 day late", "PO-2041 delivery is 4 days late"]);
    expect(titles("payment")).toEqual(["Payment due in 5 days: PO-2041"]);
    expect(titles("container")).toEqual(["Container MSKU 4471203 arrives on 2 Oct", "Duty calculated for CAIU 2298076"]);
  });

  it("reproduces the detail lines with the shared formatters", async () => {
    const { items } = await getNotifications();
    expect(items.map((n) => n.details.join(" · "))).toEqual([
      "Shenzhen Apparel · was due 29 Sep · Men’s shirts 1,800 pcs",
      "Guangzhou Textile Co. · Yiwu Trims Ltd.",
      "Guangzhou Textile Co. · ¥50,000 · about ₹15,00,000",
      "Sino Freight · FOB · 60 bundles",
      "Payment reduced by ¥2,400 · remark by Chen Yu",
      "Total clearing cost ₹3,70,500",
      "Guangzhou Textile Co. · was due 26 Sep",
    ]);
  });
});
