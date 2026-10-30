import { crc32 } from "node:zlib";

import { describe, expect, it } from "vitest";

import type { ContainersTimelineReport, DeliveriesPerDayReport, LandedCostByMonthReport, PaymentsPerSupplierReport } from "@/lib/api/reports-types";

import { toCsv } from "./csv";
import { toPdf } from "./pdf";
import { csvRows, reportFile, type ReportFile } from "./report-files";
import { toXlsx } from "./xlsx";

const TODAY = "2026-10-30";
const NONE = { from: null, to: null, supplier: null };

const payments: PaymentsPerSupplierReport = {
  filter: { from: "2026-09-01", to: "2026-09-30", supplier: "Foshan Fabrics" },
  suppliers: [
    { supplierId: "s1", supplier: "Foshan Fabrics", orders: ["PO-2047", "PO-2041"], orderValueCny: 160000.5, paidCny: 40000, paidInr: 480000, balanceCny: 120000.5 },
  ],
  totals: { orders: 2, orderValueCny: 160000.5, paidCny: 40000, paidInr: 480000, balanceCny: 120000.5 },
  dueNext30Cny: 0,
  finishedPos: [],
};
const containers: ContainersTimelineReport = {
  filter: NONE,
  from: "2026-10-05",
  to: "2026-11-23",
  containers: [{ id: "c1", number: "MSKU 4471", status: "sea", loadedOn: "2026-10-01", arrival: "2026-10-28" }],
  active: 1,
  arrivingIn7Days: [],
  averageSeaDays: null,
  nextArrival: null,
};
const noDeliveries: DeliveriesPerDayReport = {
  filter: { from: "2026-09-01", to: "2026-09-30", supplier: null },
  from: TODAY,
  to: "2026-11-12",
  days: [{ date: TODAY, count: 0 }],
  dueNext7: 0,
  suppliersNext7: 0,
  dueNext14: 0,
  busiest: null,
  daysWithNone: 14,
  late: 0,
};

/** The files of a zip written without compression, checking each entry's CRC and the directory's count and offset. */
function unzip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const files: Record<string, string> = {};
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const [size, nameLength] = [view.getUint32(at + 18, true), view.getUint16(at + 26, true)];
    const data = bytes.subarray(at + 30 + nameLength, at + 30 + nameLength + size);
    expect(view.getUint16(at + 8, true)).toBe(0);
    expect(view.getUint32(at + 14, true)).toBe(crc32(data));
    files[decoder.decode(bytes.subarray(at + 30, at + 30 + nameLength))] = decoder.decode(data);
    at += 30 + nameLength + size;
  }
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  expect(view.getUint16(end + 10, true)).toBe(Object.keys(files).length);
  expect(view.getUint32(end + 16, true)).toBe(at);
  return files;
}

/** PDF bytes as text, one character per byte. */
const pdf = (bytes: Uint8Array) => Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
const parseErrors = (xml: string) => new DOMParser().parseFromString(xml, "application/xml").getElementsByTagName("parsererror").length;

describe("report files", () => {
  it("name the file by the period, else today, and spell out the filters", () => {
    const file = reportFile("payments-per-supplier", payments, TODAY);
    expect(file).toMatchObject({ title: "Payments per supplier", filename: "payments-per-supplier-2026-09", filters: "Period: 1 Sep – 30 Sep 2026 · Supplier: Foshan Fabrics" });
    expect(reportFile("containers-timeline", containers, TODAY)).toMatchObject({
      filename: "containers-timeline-2026-10-30",
      filters: "Period: 5 Oct 2026 to 23 Nov 2026 · Supplier: All suppliers",
    });
    // 13.2 ignores the period: its own 14 days, named by today.
    expect(reportFile("deliveries-per-day", noDeliveries, TODAY)).toMatchObject({
      filename: "deliveries-per-day-2026-10-30",
      filters: "Period: 30 Oct 2026 to 12 Nov 2026 · Supplier: All suppliers",
    });
  });

  it("write CSV with currency codes in the headers, human labels and a No rows line for an empty table", () => {
    expect(toCsv(csvRows(reportFile("payments-per-supplier", payments, TODAY)))).toBe(
      "Supplier,Orders,Order value (CNY),Paid (CNY),Paid (INR),Balance (CNY)\r\n" +
        'Foshan Fabrics,"PO-2047, PO-2041",160000.5,40000,480000,120000.5\r\n' +
        "Total,2 open orders,160000.5,40000,480000,120000.5",
    );
    expect(csvRows(reportFile("containers-timeline", containers, TODAY))[1]).toEqual(["MSKU 4471", "On the sea", "2026-10-01", "2026-10-28"]);
    expect(csvRows(reportFile("deliveries-per-day", noDeliveries, TODAY))).toEqual([["Date", "Deliveries due"], ["No rows"]]);
    const months: LandedCostByMonthReport = {
      filter: NONE,
      months: [{ month: "2026-10", pieces: 1800, landedCostInr: 991440, perPieceInr: 550.8, soFar: true }],
      totals: { orders: 1, pieces: 1800, landedCostInr: 991440, perPieceInr: 550.8 },
      biggest: null,
    };
    expect(csvRows(reportFile("landed-cost-by-month", months, TODAY))[1]).toEqual(["Oct 2026 (so far)", 1800, 991440, 550.8]);
  });
});

describe("Excel file", () => {
  const file: ReportFile = {
    title: "Order status",
    filename: "order-status-2026-10-30",
    filters: "Period: All dates · Supplier: All suppliers",
    sections: [
      { columns: [{ header: "PO" }, { header: "Due", date: true }, { header: "Value (CNY)", currency: "CNY" }], rows: [["=cmd & <x>", "2026-09-30", 1500.5]] },
      { columns: [{ header: "Stage" }], rows: [] },
    ],
  };
  const files = unzip(toXlsx(file, "Generated 30 Oct 2026, 14:05"));
  const sheet = files["xl/worksheets/sheet1.xml"];

  it("is a zip of the parts Excel needs, each well-formed XML", () => {
    expect(Object.keys(files).sort()).toEqual(["[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml"]);
    for (const xml of Object.values(files)) expect(parseErrors(xml)).toBe(0);
    expect(files["xl/workbook.xml"]).toContain('<sheet name="Order status" sheetId="1" r:id="rId1"/>');
  });

  it("holds the title block, then text as text, dates as day numbers and amounts as numbers", () => {
    expect(sheet).toContain('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Order status</t></is></c>');
    expect(sheet).toContain('<c r="A3" t="inlineStr"><is><t xml:space="preserve">Generated 30 Oct 2026, 14:05</t></is></c>');
    expect(sheet).toContain('<c r="C5" t="inlineStr" s="1"><is><t xml:space="preserve">Value (CNY)</t></is></c>');
    // Formula characters stay text (an inline string never runs), escaped for XML.
    expect(sheet).toContain('<c r="A6" t="inlineStr"><is><t xml:space="preserve">=cmd &amp; &lt;x&gt;</t></is></c>');
    expect(sheet).toContain('<c r="B6" s="2"><v>46295</v></c>'); // 30 Sep 2026
    expect(sheet).toContain('<c r="C6" s="3"><v>1500.5</v></c>');
    expect(sheet).toContain('<row r="9"><c r="A9" t="inlineStr"><is><t xml:space="preserve">No rows</t></is></c></row>');
  });
});

describe("PDF file", () => {
  it("is a PDF whose cross-reference table points at each object", () => {
    const text = pdf(toPdf(reportFile("payments-per-supplier", payments, TODAY), "Generated 30 Oct 2026, 14:05"));
    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text.endsWith("%%EOF\n")).toBe(true);
    const xref = Number(/startxref\n(\d+)\n/.exec(text)?.[1]);
    expect(text.slice(xref, xref + 4)).toBe("xref");
    const offsets = [...text.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((match) => Number(match[1]));
    expect(offsets).toHaveLength(7); // catalog, pages, 2 fonts, info, 1 page and its content
    offsets.forEach((offset, index) => expect(text.slice(offset).startsWith(`${index + 1} 0 obj\n`)).toBe(true));
  });

  it("draws the title, filters, generation time, headers with currency codes, the rows and the total", () => {
    const text = pdf(toPdf(reportFile("payments-per-supplier", payments, TODAY), "Generated 30 Oct 2026, 14:05"));
    for (const shown of ["Payments per supplier", "Generated 30 Oct 2026, 14:05", "Paid \\(INR\\)", "Foshan Fabrics", "PO-2047, PO-2041", "1,60,000.50", "4,80,000.00", "Total"]) {
      expect(text).toContain(`(${shown}) Tj`);
    }
    // The en dash and middle dot in WinAnsi bytes; no ₹ or ¥ anywhere.
    expect(text).toContain("(Period: 1 Sep \x96 30 Sep 2026 \xB7 Supplier: Foshan Fabrics) Tj");
    expect(text).not.toMatch(/[₹¥]/);
  });

  it("prints characters Helvetica lacks as ?, writes No rows for an empty table and repeats the header on new pages", () => {
    const lines = Array.from({ length: 80 }, (_, index) => ({ ...payments.suppliers[0], supplierId: `s${index}`, supplier: `义乌 Trims ${index}` }));
    const text = pdf(toPdf(reportFile("payments-per-supplier", { ...payments, suppliers: lines }, TODAY), "Generated"));
    expect(text).toContain("(?? Trims 0) Tj");
    expect(text).toMatch(/\/Count [2-9] /);
    expect(text.match(/\(Order value \\\(CNY\\\)\) Tj/g)?.length).toBe(Number(/\/Count (\d)/.exec(text)?.[1]));
    expect(pdf(toPdf(reportFile("deliveries-per-day", noDeliveries, TODAY), "Generated"))).toContain("(No rows) Tj");
  });
});
