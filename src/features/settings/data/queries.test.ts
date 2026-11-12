import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { apiGet } from "@/lib/api/server";

import * as queries from "./queries";

vi.mock("@/lib/api/server", () => ({ apiGet: vi.fn() }));
const get = vi.mocked(apiGet);

const LISTS = [
  ["getShippingAgents", "/shipping-agents"],
  ["getClearingAgents", "/clearing-agents"],
  ["getTransportCompanies", "/transport-companies"],
  ["getLocations", "/locations"],
  ["getTeams", "/teams"],
  ["getItems", "/items"],
] as const;

describe("Settings queries read the API", () => {
  beforeEach(() => get.mockReset());

  it.each(LISTS)("%s returns GET %s unchanged", async (name, path) => {
    const rows = [{ id: "api-row" }];
    get.mockResolvedValueOnce(rows);
    expect(await queries[name]()).toBe(rows);
    expect(get).toHaveBeenCalledWith(path);
  });

  it("Suppliers come from GET /suppliers with the currency master; the Add supplier draft starts empty", async () => {
    const rows = [{ id: "api-supplier" }];
    const currencies = [{ code: "AED", name: "United Arab Emirates Dirham", isoName: "UAE Dirham", symbol: "AED", minorUnits: 2 }];
    get.mockImplementation(async (path: string) => (path === "/currencies" ? { currencies, preferred: ["CNY", "USD", "INR"] } : rows));
    const data = await queries.getSuppliersSettings();
    expect(data.suppliers).toBe(rows);
    expect(data.currencies).toBe(currencies);
    expect(get).toHaveBeenCalledWith("/suppliers");
    expect(get).toHaveBeenCalledWith("/currencies");
    expect(data.draft).toMatchObject({ name: "", city: "", contactPerson: "", phone: "" });
  });

  it("a currency master that fails to load leaves the picker's list empty instead of failing the page", async () => {
    const rows = [{ id: "api-supplier" }];
    get.mockImplementation(async (path: string) => {
      if (path === "/currencies") throw new ApiError(500, "server_error", "Something went wrong.");
      return rows;
    });
    expect(await queries.getSuppliersSettings()).toMatchObject({ suppliers: rows, currencies: [] });
  });

  it.each([...LISTS.map(([name]) => name), "getSuppliersSettings" as const])(
    "%s fails when the API fails, so the error page shows instead of sample records",
    async (name) => {
      const failure = new ApiError(500, "server_error", "Something went wrong.");
      get.mockRejectedValueOnce(failure).mockResolvedValue({ currencies: [], preferred: [] });
      await expect(queries[name]()).rejects.toBe(failure);
    },
  );
});
