import { type Cell, type Column, NO_ROWS, type ReportFile } from "./report-files";

// The Excel file of a report: a minimal .xlsx (one sheet of Office Open XML in an uncompressed zip, no library). The
// title, filters and generation time, then each table: bold header and total, numbers as numbers, dates as dates
// ("30 Sep 2026"), amounts with two decimals. Text is written as text, so it never runs as a formula.

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG = "http://schemas.openxmlformats.org/package/2006/relationships";
const TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml";

// cellXfs below: 0 text, 1 bold, 2 date, 3 amount, 4 bold amount.
const STYLES = `${XML}<styleSheet xmlns="${MAIN}"><numFmts count="1"><numFmt numFmtId="164" formatCode="d mmm yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

type Row = { cells: Cell[]; columns?: Column[]; bold?: boolean };

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
/** XML text: & < > " escaped, and the control characters XML can't hold dropped. */
const escape = (text: string) => text.replace(/[^\t\n\r -�]/g, "").replace(/[&<>"]/g, (c) => ENTITIES[c]);
/** A, B, … Z, AA, … */
const letter = (index: number): string => (index >= 26 ? letter(Math.floor(index / 26) - 1) : "") + String.fromCharCode(65 + (index % 26));
/** Excel's day number of a YYYY-MM-DD date (days since 30 Dec 1899). */
const serial = (date: string) => (Date.parse(date) - Date.UTC(1899, 11, 30)) / 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function cellXml(value: Cell, ref: string, column: Column | undefined, bold = false) {
  if (value === null) return "";
  if (typeof value === "number") return `<c r="${ref}" s="${column?.currency ? (bold ? 4 : 3) : bold ? 1 : 0}"><v>${value}</v></c>`;
  if (column?.date && ISO_DATE.test(value)) return `<c r="${ref}" s="2"><v>${serial(value)}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${bold ? ' s="1"' : ""}><is><t xml:space="preserve">${escape(value)}</t></is></c>`;
}

/** Characters a cell needs, for the column width. */
const length = (value: Cell, column?: Column) => (value === null ? 0 : typeof value === "number" ? String(value).length + 4 : column?.date ? 11 : value.length);

export function toXlsx(file: ReportFile, generated: string) {
  const rows: Row[] = [
    { cells: [file.title], bold: true },
    { cells: [file.filters] },
    { cells: [generated] },
    ...file.sections.flatMap((s): Row[] => [
      { cells: [] },
      { cells: s.columns.map((c) => c.header), columns: s.columns, bold: true },
      ...(s.rows.length ? s.rows : [[NO_ROWS]]).map((cells) => ({ cells, columns: s.columns })),
      ...(s.total ? [{ cells: s.total, columns: s.columns, bold: true }] : []),
    ]),
  ];
  // The title block overflows into the empty cells beside it, so only the tables size the columns.
  const widths: number[] = [];
  for (const { cells, columns } of rows.filter((row) => row.columns)) {
    cells.forEach((value, index) => (widths[index] = Math.max(widths[index] ?? 8, Math.min(50, length(value, columns?.[index]) + 2))));
  }
  const sheet = `${XML}<worksheet xmlns="${MAIN}"><cols>${widths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join("")}</cols><sheetData>${rows
    .map((row, r) => `<row r="${r + 1}">${row.cells.map((value, c) => cellXml(value, `${letter(c)}${r + 1}`, row.columns?.[c], row.bold)).join("")}</row>`)
    .join("")}</sheetData></worksheet>`;

  return zip({
    "[Content_Types].xml": `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${TYPE}.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="${TYPE}.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="${TYPE}.styles+xml"/></Types>`,
    "_rels/.rels": `${XML}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `${XML}<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets><sheet name="${escape(file.title)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `${XML}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": STYLES,
    "xl/worksheets/sheet1.xml": sheet,
  });
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});

function crc32(bytes: Uint8Array) {
  let crc = ~0;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return ~crc >>> 0;
}

/** Little-endian fields of [byte size (2 or 4), value]. */
function fields(list: [2 | 4, number][]) {
  const out = new Uint8Array(list.reduce((sum, [size]) => sum + size, 0));
  const view = new DataView(out.buffer);
  let at = 0;
  for (const [size, value] of list) {
    if (size === 2) view.setUint16(at, value, true);
    else view.setUint32(at, value, true);
    at += size;
  }
  return out;
}

/** A zip of UTF-8 text files, stored without compression (PKWARE APPNOTE 4.3). */
function zip(files: Record<string, string>) {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const path = encoder.encode(name);
    const data = encoder.encode(text);
    // Version 2.0, no flags, stored, 1 Jan 1980 00:00, CRC, both sizes, name length, no extra field.
    const entry: [2 | 4, number][] = [[2, 20], [2, 0], [2, 0], [2, 0], [2, 0x21], [4, crc32(data)], [4, data.length], [4, data.length], [2, path.length], [2, 0]];
    const local = [fields([[4, 0x04034b50], ...entry]), path, data];
    // Made by 2.0; no comment, disk 0, no attributes; where the local header starts.
    directory.push(fields([[4, 0x02014b50], [2, 20], ...entry, [2, 0], [2, 0], [2, 0], [4, 0], [4, offset]]), path);
    parts.push(...local);
    offset += local.reduce((sum, part) => sum + part.length, 0);
  }
  const size = directory.reduce((sum, part) => sum + part.length, 0);
  const count = Object.keys(files).length;
  const end = fields([[4, 0x06054b50], [2, 0], [2, 0], [2, count], [2, count], [4, size], [4, offset], [2, 0]]);
  const out = new Uint8Array(offset + size + end.length);
  let at = 0;
  for (const part of [...parts, ...directory, end]) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
