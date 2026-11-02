import { describe, expect, it } from "vitest";

import { detailQuery, withParams } from "./supplier-detail-params";

const query = (search: string) => detailQuery(new URLSearchParams(search));

describe("detailQuery", () => {
  it("turns the period into from/to and forwards well-formed list filters and pages", () => {
    expect(query("period=2026-02&supplier=x&paymentFrom=2026-02-01&paymentTo=2026-02-28&stage=3&paymentsPage=2&ordersPage=1&linesPage=12")).toBe(
      "?from=2026-02-01&to=2026-02-28&paymentFrom=2026-02-01&paymentTo=2026-02-28&stage=3&paymentsPage=2&ordersPage=1&linesPage=12",
    );
    expect(query("")).toBe("");
  });

  it("leaves out malformed values instead of sending the API a 400", () => {
    expect(query("period=2026-13&paymentFrom=2026-02-30&paymentTo=26-1-1&stage=7&paymentsPage=0&ordersPage=1.5&linesPage=9999999&foo=1")).toBe("");
    expect(query("stage=0&stage=2&paymentsPage=-1")).toBe("");
  });

  it("swaps a payment range written backwards", () => {
    expect(query("paymentFrom=2026-03-31&paymentTo=2026-03-01")).toBe("?paymentFrom=2026-03-01&paymentTo=2026-03-31");
    // A malformed end is dropped, not swapped in.
    expect(query("paymentFrom=2026-03-31&paymentTo=2026-02-30")).toBe("?paymentFrom=2026-03-31");
    expect(query("paymentFrom=2026-03-31&paymentTo=2026-03-31")).toBe("?paymentFrom=2026-03-31&paymentTo=2026-03-31");
  });

  it.each([
    "period=2026-02&supplier=x&paymentFrom=2026-02-29&stage=1&linesPage=2",
    "period=2026-12&paymentTo=2026-12-31&ordersPage=999999",
    "foo=1&supplier=00000000-0000-4000-8000-000000000000&period=2026-1&stage=3&stage=4",
    "paymentsPage=1e3&ordersPage=+2&linesPage=0x10&stage=03",
  ])("sends only keys and values the strict API takes: %s", (search) => {
    const sent = new URLSearchParams(query(search));
    const API = /^(from|to|paymentFrom|paymentTo)=\d{4}-\d{2}-\d{2}$|^stage=[1-6]$|^(paymentsPage|ordersPage|linesPage)=[1-9]\d*$/;
    for (const [key, value] of sent) expect(`${key}=${value}`).toMatch(API);
    expect(new Set(sent.keys()).size).toBe(sent.size); // never a repeated key
  });

  it("gives December its 31 days and a leap February its 29", () => {
    expect(query("period=2026-12")).toBe("?from=2026-12-01&to=2026-12-31");
    expect(query("period=2028-02")).toBe("?from=2028-02-01&to=2028-02-29");
  });
});

describe("withParams", () => {
  it("sets and removes keys, keeping the rest", () => {
    expect(withParams("period=2026-02&paymentsPage=3", { paymentFrom: "2026-02-01", paymentsPage: null })).toBe("period=2026-02&paymentFrom=2026-02-01");
    expect(withParams("stage=2", { stage: null })).toBe("");
  });
});
