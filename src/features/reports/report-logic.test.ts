import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";
import { filterLabel, filterQuery, idQuery, periodLabel, periodOptions, reportQuery } from "./data/filters";
import { axisPercent, barSpan, monthLabel, timelineAxis } from "./report-logic";

const ID = "5f0c7a52-8a0e-4c1e-9d3b-2b9c1f7e4a10";

describe("timeline axis (13.4)", () => {
  const axis = { start: "2026-09-05", end: "2026-10-25" };

  it("maps dates linearly from start (0 %) to end (100 %)", () => {
    expect(axisPercent("2026-09-05", axis.start, axis.end)).toBe(0);
    expect(axisPercent("2026-10-25", axis.start, axis.end)).toBe(100);
    expect(axisPercent("2026-09-30", axis.start, axis.end)).toBe(50);
  });

  it("places bars where the reference draws them, cut to the axis", () => {
    expect(barSpan("2026-09-09", "2026-09-28", axis)).toEqual({ left: 8, width: 38 });
    expect(barSpan("2026-09-26", "2026-10-24", axis)).toEqual({ left: 42, width: 56 });
    expect(barSpan("2026-08-01", "2026-09-15", axis)).toEqual({ left: 0, width: 20 });
    expect(barSpan("2026-10-20", "2026-11-30", axis)).toEqual({ left: 90, width: 10 });
  });

  it("ticks every 10 days and on the last day of the window, as the reference does", () => {
    expect(timelineAxis("2026-09-05", "2026-10-24")).toEqual({
      start: "2026-09-05",
      end: "2026-10-25",
      ticks: ["2026-09-05", "2026-09-15", "2026-09-25", "2026-10-05", "2026-10-15", "2026-10-24"],
    });
    expect(timelineAxis("2026-09-01", "2026-09-30").ticks).toEqual(["2026-09-01", "2026-09-11", "2026-09-21", "2026-09-30"]);
  });

  it("labels months", () => {
    expect(monthLabel("2026-09")).toBe("Sep 2026");
  });
});

describe("report filters", () => {
  const params = (query: string) => new URLSearchParams(query);

  it("turns ?period and ?supplier into the API's from, to and supplierId", () => {
    expect(reportQuery(params(`period=2026-09&supplier=${ID}`))).toBe(`?from=2026-09-01&to=2026-09-30&supplierId=${ID}`);
    expect(reportQuery(params("period=2026-02"))).toBe("?from=2026-02-01&to=2026-02-28");
    expect(reportQuery(params("period=2026-13&supplier=abc"))).toBe("");
    expect(reportQuery(params(""))).toBe("");
  });

  it("keeps only well-formed ids for Landed Cost", () => {
    expect(idQuery(params(`supplier=${ID}&team=x`), { supplier: "supplierId", team: "teamId" })).toBe(`?supplierId=${ID}`);
  });

  it("carries the hub's filters, and nothing else, to the reports and back", () => {
    expect(filterQuery(params(`period=2026-09&supplier=${ID}&dialog=add`))).toBe(`?period=2026-09&supplier=${ID}`);
    expect(filterQuery(params("dialog=add"))).toBe("");
  });

  it("offers all dates and the last 12 months, labelled as the reference", () => {
    const options = periodOptions("2026-10-28");
    expect(options).toHaveLength(13);
    expect(options.slice(0, 3)).toEqual([
      { value: "all", label: "All dates" },
      { value: "2026-10", label: "1 Oct – 31 Oct 2026" },
      { value: "2026-09", label: "1 Sep – 30 Sep 2026" },
    ]);
    expect(options.at(-1)?.value).toBe("2025-11");
    expect(periodLabel("2026-09")).toBe("1 Sep – 30 Sep 2026");
  });

  it("shows a filtered report's period and supplier in its header pill", () => {
    expect(filterLabel({ from: "2026-09-01", supplier: "Foshan Fabrics" })).toBe("1 Sep – 30 Sep 2026 · Foshan Fabrics");
    expect(filterLabel({ from: null, supplier: "Foshan Fabrics" })).toBe("Foshan Fabrics");
    expect(filterLabel({ from: null, supplier: null })).toBeNull();
  });
});

describe("CSV export", () => {
  it("writes numbers as they are, empties for null, and quotes text with commas, quotes or line breaks", () => {
    expect(toCsv([["PO", "Orders", "Value"], ["PO-2047", "PO-2047, PO-2041", 160000.5], ['Say "hi"', "two\nlines", null]])).toBe(
      'PO,Orders,Value\r\nPO-2047,"PO-2047, PO-2041",160000.5\r\n"Say ""hi""","two\nlines",',
    );
  });

  it("stops typed text from running as a spreadsheet formula, but leaves negative numbers alone", () => {
    expect(toCsv([["=HYPERLINK(1)", "+1", "-x", "@sum", -5]])).toBe("'=HYPERLINK(1),'+1,'-x,'@sum,-5");
  });

  it("writes an empty row as an empty line", () => {
    expect(toCsv([["a"], [], ["b"]])).toBe("a\r\n\r\nb");
  });
});
