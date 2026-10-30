import { afterEach, describe, expect, it, vi } from "vitest";

import { apiGet } from "@/lib/api/server";
import type { DeliveryItem, Me } from "@/lib/api/types";
import { getMe } from "@/lib/session";

import { getCalendar } from "./queries";

vi.mock("@/lib/api/server", () => ({ apiGet: vi.fn() }));
vi.mock("@/lib/session", () => ({ getMe: vi.fn() }));

const me = (ordersView: "None" | "View") => ({ shell: "management", permissions: { ordersView } }) as unknown as Me;

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
  vi.mocked(getMe).mockReset();
});

describe("getCalendar", () => {
  it("maps CAL-1 rows against today in India, without fully received orders, and links POs for users who can open Orders", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-26T20:00:00Z")); // 01:30 on 27 Oct in India
    vi.mocked(apiGet).mockResolvedValue([item, { ...item, orderId: "o2", po: "PO-2051", received: 5_000 }]);
    vi.mocked(getMe).mockResolvedValue(me("View"));

    await expect(getCalendar()).resolves.toEqual({
      today: "2026-10-27",
      linkOrders: true,
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

  it("shows POs as plain text without Orders access or a session", async () => {
    vi.mocked(apiGet).mockResolvedValue([item]);
    vi.mocked(getMe).mockResolvedValue(me("None"));
    expect((await getCalendar()).linkOrders).toBe(false);
    vi.mocked(getMe).mockResolvedValue(null);
    expect((await getCalendar()).linkOrders).toBe(false);
  });

  it("rejects when the API call fails", async () => {
    vi.mocked(apiGet).mockRejectedValue(new Error("GET /deliveries failed"));
    await expect(getCalendar()).rejects.toThrow("GET /deliveries failed");
  });
});
