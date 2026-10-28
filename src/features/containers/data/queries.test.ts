import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { ContainerDetail, ContainerListItem } from "@/lib/api/types";

import { getContainerDetail, getContainersList, getLoadContainer } from "./queries";

const apiGet = vi.fn();
vi.mock("@/lib/api/server", () => ({ apiGet: (path: string) => apiGet(path) }));
vi.mock("@/lib/today", () => ({ todayInIndia: () => "2026-09-30" }));
const getMe = vi.fn();
vi.mock("@/lib/session", () => ({ getMe: () => getMe() }));
const loader = { shell: "staff", permissions: { containers: "Enter", ordersView: "None" } };
/** Containers View only, with Orders access. */
const viewer = { shell: "management", permissions: { containers: "View", ordersView: "View" } };

beforeEach(() => {
  vi.clearAllMocks();
  getMe.mockResolvedValue(loader);
});

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
  it("maps CON-1 rows, KPIs, footnote, agents and what the user may do", async () => {
    apiGet.mockResolvedValue([row]);
    const data = await getContainersList();
    expect(apiGet).toHaveBeenCalledWith("/containers");
    expect(data.containers[0]).toMatchObject({ id: "c1", agent: "Sino Freight", orders: row.orders, etaIndia: "2026-10-02" });
    expect(data.kpis).toEqual({ active: 1, arrivingThisWeek: ["MSKU 4471203"], loadingNow: [], arrivedInClearing: [] });
    expect(data.footnote).toContain("(PO-2037 above)");
    expect(data.agents).toEqual(["Sino Freight"]);
    expect(data).toMatchObject({ canEnter: true, linkPos: false });
    getMe.mockResolvedValue(viewer);
    expect(await getContainersList()).toMatchObject({ canEnter: false, linkPos: true });
  });

  it("returns CON-2 options with today, or null without Enter (no CON-2 call)", async () => {
    const options = { agents: [{ id: "a1", name: "Sino Freight" }], lines: [] };
    apiGet.mockResolvedValue(options);
    expect(await getLoadContainer()).toEqual({ ...options, today: "2026-09-30" });
    expect(apiGet).toHaveBeenCalledWith("/containers/options");

    apiGet.mockClear();
    getMe.mockResolvedValue(viewer);
    expect(await getLoadContainer()).toBeNull();
    getMe.mockResolvedValue(null);
    expect(await getLoadContainer()).toBeNull();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("reads CON-4, and null for an unknown container", async () => {
    const detail: ContainerDetail = { ...row, portOfLoading: "Nansha", portOfArrival: "Kochi", lines: [] };
    apiGet.mockResolvedValue(detail);
    expect(await getContainerDetail("c1")).toEqual({ container: detail, today: "2026-09-30", canEnter: true, linkPos: false });
    expect(apiGet).toHaveBeenCalledWith("/containers/c1");

    apiGet.mockRejectedValue(new ApiError(404, "not_found", "Container not found."));
    expect(await getContainerDetail("nope")).toBeNull();
  });

  it("rejects when the API fails (no fallback)", async () => {
    apiGet.mockRejectedValue(new ApiError(500, "internal", "Something went wrong."));
    await expect(getContainersList()).rejects.toBeInstanceOf(ApiError);
    await expect(getLoadContainer()).rejects.toBeInstanceOf(ApiError);
    await expect(getContainerDetail("c1")).rejects.toBeInstanceOf(ApiError);
  });
});
