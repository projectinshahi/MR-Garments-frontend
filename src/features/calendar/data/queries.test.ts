import { afterEach, describe, expect, it, vi } from "vitest";

import { apiGet } from "@/lib/api/server";
import type { DeliveryItem } from "@/lib/api/types";

import { getCalendar } from "./queries";

vi.mock("@/lib/api/server", () => ({ apiGet: vi.fn() }));

const item: DeliveryItem = {
  orderId: "o1",
  po: "PO-2050",
  supplier: "Foshan Fabrics",
  item: "Denim fabric",
  quantity: 5_000,
  unit: "m",
  received: 1_200,
  due: "2026-10-25",
};

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(apiGet).mockReset();
});

describe("getCalendar", () => {
  it("maps CAL-1 rows against today in India and shows today's month", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-26T20:00:00Z")); // 01:30 on 27 Oct in India
    vi.mocked(apiGet).mockResolvedValue([item]);

    await expect(getCalendar()).resolves.toEqual({
      today: "2026-10-27",
      month: "2026-10-01",
      deliveries: [
        { po: "PO-2050", supplier: "Foshan Fabrics", item: "Denim fabric", quantity: 5_000, unit: "m", due: "2026-10-25", status: "late", statusLabel: "2 days late" },
      ],
    });
    expect(apiGet).toHaveBeenCalledWith("/deliveries");
  });

  it("returns no deliveries when the API has none", async () => {
    vi.mocked(apiGet).mockResolvedValue([]);
    expect((await getCalendar()).deliveries).toEqual([]);
  });

  it("rejects when the API call fails", async () => {
    vi.mocked(apiGet).mockRejectedValue(new Error("GET /deliveries failed"));
    await expect(getCalendar()).rejects.toThrow("GET /deliveries failed");
  });
});
