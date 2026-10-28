import { describe, expect, it } from "vitest";

import { orderStatus } from "./order-status";

const TODAY = "2026-10-27";
type Facts = Parameters<typeof orderStatus>[0];
const order: Facts = { stage: 1, deliveryDate: "2026-11-20", quantity: 2400, received: 0, unit: "m" };
const status = (patch: Partial<Facts>) => orderStatus({ ...order, ...patch }, TODAY);

describe("orderStatus", () => {
  it("names stages 4, 5 and 6 whatever the dates", () => {
    expect(status({ stage: 4, deliveryDate: "2026-01-01" })).toEqual({ label: "In clearing", tone: "info", chip: null });
    expect(status({ stage: 5 })).toEqual({ label: "On the road", tone: "info", chip: null });
    expect(status({ stage: 6 })).toEqual({ label: "Received", tone: "success", chip: null });
  });

  it("shows a short stage-3 order by the missing quantity, and a full one by its dates", () => {
    expect(status({ stage: 3, quantity: 1200, received: 1160, unit: "pcs" })).toEqual({
      label: "Short by 40 pcs",
      tone: "warning",
      chip: "shortReceived",
    });
    expect(status({ stage: 3, received: 2400, deliveryDate: "2026-09-05" })).toEqual({ label: "On track", tone: "success", chip: null });
  });

  it("is late only before today at stage 1 or 2", () => {
    expect(status({ deliveryDate: "2026-10-26" })).toEqual({ label: "Late 1 day", tone: "danger", chip: "late" });
    expect(status({ stage: 2, deliveryDate: "2026-10-23" })).toMatchObject({ label: "Late 4 days", chip: "late" });
  });

  it("is due from today to 7 days ahead, then on track", () => {
    expect(status({ deliveryDate: TODAY })).toEqual({ label: "Due today", tone: "warning", chip: "dueSoon" });
    expect(status({ deliveryDate: "2026-10-28" })).toMatchObject({ label: "Due in 1 day", chip: "dueSoon" });
    expect(status({ deliveryDate: "2026-11-03" })).toMatchObject({ label: "Due in 7 days", chip: "dueSoon" });
    expect(status({ deliveryDate: "2026-11-04" })).toEqual({ label: "On track", tone: "success", chip: null });
  });
});
