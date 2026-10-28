import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { ContainerListItem } from "@/lib/api/types";

import { getContainersList, getLoadContainer } from "./queries";

const apiGet = vi.fn();
vi.mock("@/lib/api/server", () => ({ apiGet: (path: string) => apiGet(path) }));
vi.mock("@/lib/today", () => ({ todayInIndia: () => "2026-09-30" }));

beforeEach(() => vi.clearAllMocks());

const row: ContainerListItem = {
  id: "c1",
  number: "MSKU 4471203",
  agent: { id: "a1", name: "Sino Freight" },
  terms: "FOB",
  loadedOn: "2026-09-14",
  sailedOn: "2026-09-16",
  eta: "2026-10-02",
  etaEstimated: false,
  status: "sea",
  bundles: 60,
  orders: [
    { po: "PO-2027", part: false },
    { po: "PO-2037", part: true },
  ],
};

describe("containers queries", () => {
  it("maps CON-1 rows, KPIs, footnote and agents", async () => {
    apiGet.mockResolvedValue([row]);
    const data = await getContainersList();
    expect(apiGet).toHaveBeenCalledWith("/containers");
    expect(data.containers[0]).toMatchObject({ id: "c1", agent: "Sino Freight", orders: ["PO-2027", "PO-2037 (part)"], etaIndia: "2026-10-02" });
    expect(data.kpis).toEqual({ active: 1, arrivingThisWeek: ["MSKU 4471203"], loadingNow: [], arrivedInClearing: [] });
    expect(data.footnote).toContain("(PO-2037 above)");
    expect(data.agents).toEqual(["Sino Freight"]);
  });

  it("returns CON-2 options with today", async () => {
    const options = { agents: [{ id: "a1", name: "Sino Freight" }], lines: [] };
    apiGet.mockResolvedValue(options);
    expect(await getLoadContainer()).toEqual({ ...options, today: "2026-09-30" });
    expect(apiGet).toHaveBeenCalledWith("/containers/options");
  });

  it("rejects when the API fails (no fallback)", async () => {
    apiGet.mockRejectedValue(new ApiError(500, "internal", "Something went wrong."));
    await expect(getContainersList()).rejects.toBeInstanceOf(ApiError);
    await expect(getLoadContainer()).rejects.toBeInstanceOf(ApiError);
  });
});
