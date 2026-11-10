import { describe, expect, it } from "vitest";

import { orderReportsFilterLabel, orderReportsQuery } from "./params";

const ID = "5f0c7a52-8a0e-4c1e-9d3b-2b9c1f7e4a10";
const query = (search: string) => orderReportsQuery(new URLSearchParams(search));

describe("order reports query", () => {
  it("is empty without filters and maps each URL parameter to the API's name", () => {
    expect(query("")).toBe("");
    expect(query(`po= PO-20 &supplierName= fosh &supplier=${ID}&from=2026-09-01&to=2026-09-30&status=closed&stage=4&currency=USD&warehouse=${ID}&paymentStatus=partly`)).toBe(
      `?po=PO-20&supplier=fosh&supplierId=${ID}&from=2026-09-01&to=2026-09-30&status=closed&stage=4&currency=USD&warehouseId=${ID}&paymentStatus=partly`,
    );
  });

  it("leaves out malformed values, puts a swapped date range the right way round and trims an over-long PO", () => {
    expect(query("po=&supplierName=&supplier=abc&from=2026-02-30&to=yesterday&status=done&stage=7&currency=EUR&warehouse=1&paymentStatus=half")).toBe("");
    expect(query("from=2026-09-30&to=2026-09-01")).toBe("?from=2026-09-01&to=2026-09-30");
    expect(query(`po=${"x".repeat(60)}`)).toBe(`?po=${"x".repeat(50)}`);
  });

  it("takes the hub's ?period as the order-date range unless from or to is given", () => {
    expect(query("period=2026-09")).toBe("?from=2026-09-01&to=2026-09-30");
    expect(query("period=2026-09&from=2026-09-15")).toBe("?from=2026-09-15");
    expect(query("period=2026-13")).toBe("");
  });
});

describe("order reports filter label", () => {
  const none = { po: null, supplierName: null, supplier: null, from: null, to: null, status: null, stage: null, currency: null, warehouse: null, paymentStatus: null };

  it("is null when unfiltered and joins the filters as the API echoed them", () => {
    expect(orderReportsFilterLabel(none)).toBeNull();
    expect(
      orderReportsFilterLabel({ po: "20", supplierName: "fosh", supplier: "Foshan Fabrics", from: "2026-09-01", to: "2026-09-30", status: "closed", stage: 4, currency: "USD", warehouse: "Main warehouse", paymentStatus: "partly" }),
    ).toBe("PO: 20 · Supplier: fosh · Foshan Fabrics · 1 Sep 2026 to 30 Sep 2026 · Closed · 4. Clearing in India · USD · Main warehouse · Partly paid");
    expect(orderReportsFilterLabel({ ...none, from: "2026-09-01" })).toBe("From 1 Sep 2026");
    expect(orderReportsFilterLabel({ ...none, to: "2026-09-30", status: "pending" })).toBe("To 30 Sep 2026 · Pending");
  });
});
