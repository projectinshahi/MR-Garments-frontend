import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { ReceiptListItem, ReceiptOptions } from "@/lib/api/types";

import { getReceivingList, getRecordReceipt } from "./queries";

const apiGet = vi.fn();
vi.mock("@/lib/api/server", () => ({ apiGet: (path: string) => apiGet(path) }));
const getMe = vi.fn();
vi.mock("@/lib/session", () => ({ getMe: () => getMe() }));
const manager = { name: "Chen Yu", shell: "management", permissions: { receiving: "Enter", ordersView: "View" } };
/** China staff with receiving View only and no Orders access. */
const viewer = { name: "Li Na", shell: "staff", permissions: { receiving: "View", ordersView: "None" } };

const row: ReceiptListItem = {
  id: "r1",
  receivedOn: "2026-10-24",
  orderId: "o35",
  po: "PO-2035",
  supplier: "Shenzhen Apparel",
  item: "Men's jackets",
  office: "Guangzhou office",
  ordered: 1200,
  unit: "pcs",
  thisReceipt: 1200,
  totalSoFar: 1200,
  bundles: 24,
  receivedBy: "Chen Yu",
};
const options: ReceiptOptions = { offices: [{ id: "loc-gz", name: "Guangzhou office" }], orders: [] };

const answer = (routes: Record<string, unknown>) =>
  apiGet.mockImplementation(async (path: string) => {
    const value = routes[path];
    if (value instanceof Error) throw value;
    return value;
  });

beforeEach(() => {
  vi.clearAllMocks();
  getMe.mockResolvedValue(manager);
});

describe("getReceivingList", () => {
  it("maps REC-1 rows and takes the filter options from them", async () => {
    answer({ "/receipts": [row, { ...row, id: "r0", supplier: "Foshan Fabrics", office: "Yiwu office" }], "/receipts/options": options });
    const data = await getReceivingList();
    expect(data.receipts[0]).toMatchObject({ id: "r1", po: "PO-2035", state: "complete", statusLabel: "Complete", short: 0, bundles: 24 });
    expect(data.offices).toEqual(["Guangzhou office", "Yiwu office"]);
    expect(data.suppliers).toEqual(["Foshan Fabrics", "Shenzhen Apparel"]);
    expect(data.kpis.waitingToBeReceived).toBe(0);
    expect(data).toMatchObject({ canRecord: true, linkPos: true });
  });

  it("hides Record receipt and PO links from a viewer without Enter or Orders access", async () => {
    getMe.mockResolvedValue(viewer);
    answer({ "/receipts": [row], "/receipts/options": new ApiError(403, "forbidden", "No") });
    expect(await getReceivingList()).toMatchObject({ canRecord: false, linkPos: false });
  });

  it("shows an unknown waiting count to a viewer without REC-2 access", async () => {
    answer({ "/receipts": [], "/receipts/options": new ApiError(403, "forbidden", "No") });
    const data = await getReceivingList();
    expect(data.receipts).toEqual([]);
    expect(data.kpis.waitingToBeReceived).toBeNull();
  });

  it("rejects when the API fails, never falling back", async () => {
    answer({ "/receipts": new ApiError(500, "unexpected", "Something went wrong."), "/receipts/options": options });
    await expect(getReceivingList()).rejects.toBeInstanceOf(ApiError);
    answer({ "/receipts": [], "/receipts/options": new ApiError(500, "unexpected", "Something went wrong.") });
    await expect(getReceivingList()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("getRecordReceipt", () => {
  it("returns the REC-2 choices, REC-1 receipts and the signed-in user", async () => {
    answer({ "/receipts": [row], "/receipts/options": options });
    const data = await getRecordReceipt();
    expect(data).toMatchObject({ options, receipts: [row], receivedBy: "Chen Yu" });
    expect(data?.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("is null, without calling the API, below receiving Enter", async () => {
    getMe.mockResolvedValue(viewer);
    expect(await getRecordReceipt()).toBeNull();
    getMe.mockResolvedValue(null);
    expect(await getRecordReceipt()).toBeNull();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("rejects when REC-2 fails", async () => {
    answer({ "/receipts": [row], "/receipts/options": new ApiError(403, "forbidden", "No") });
    await expect(getRecordReceipt()).rejects.toBeInstanceOf(ApiError);
  });
});
