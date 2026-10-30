import { formatDate, formatNumber } from "@/lib/formatters";

import { type Cell, type Column, NO_ROWS, type ReportFile } from "./report-files";

// The PDF of a report: the title, filters and generation time, then each table (long text wrapped, the header repeated
// on every page), on A4 landscape pages numbered in the footer. Written directly (no library) in Helvetica, a PDF
// standard font every reader has. It draws Western European text (WinAnsi) only, so amounts show their currency code in
// the header, never ₹ or ¥, and a character it lacks prints as "?".

const [WIDTH, HEIGHT, MARGIN] = [842, 595, 36];
const SIZE = 8; // table text, on 10 pt lines
const LINE = 10;
const PAD = 4;

// Helvetica-Bold advance widths (1/1000 em) of " " to "~", used for regular text too, as bold is never narrower.
const ADVANCE = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, // space to /
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, // 0 to @
  722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, // A to Z
  333, 278, 333, 584, 556, 333, // [ to `
  556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, // a to z
  389, 280, 389, 584, // { to ~
];
// WinAnsiEncoding 0x80-0x9F ("?" where it has no character); 0xA0-0xFF are Latin-1, as in Unicode.
const WIN_ANSI = "€?‚ƒ„…†‡ˆ‰Š‹Œ?Ž??‘’“”•–—˜™š›œ?žŸ";

/** The text as WinAnsi bytes, one character per byte: tabs and line breaks become spaces, characters Helvetica lacks "?". */
const encode = (text: string) =>
  Array.from(text, (char) => {
    const code = char.charCodeAt(0);
    if (code < 0x20) return " ";
    if (code < 0x7f || (code >= 0xa0 && code <= 0xff)) return char;
    const index = WIN_ANSI.indexOf(char);
    return index < 0 ? "?" : String.fromCharCode(0x80 + index);
  }).join("");

/** Width in points of encoded table text (other characters counted 1 em, so wider than they are). */
const measure = (text: string) => ([...text].reduce((sum, char) => sum + (ADVANCE[char.charCodeAt(0) - 32] ?? 1000), 0) * SIZE) / 1000;

/** Encoded text in lines of at most `room` points: broken at spaces, a longer word anywhere. */
function wrap(text: string, room: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    let next = line ? `${line} ${word}` : word;
    if (line && measure(next) > room) {
      lines.push(line);
      next = word;
    }
    while (next.length > 1 && measure(next) > room) {
      let cut = next.length - 1;
      while (cut > 1 && measure(next.slice(0, cut)) > room) cut--;
      lines.push(next.slice(0, cut));
      next = next.slice(cut);
    }
    line = next;
  }
  return [...lines, line];
}

/** Column widths: their natural widths when they fit, else the narrow columns keep theirs and the wide ones share the rest. */
function share(natural: number[], room: number) {
  const widths = [...natural];
  let left = room;
  const order = natural.map((_, index) => index).sort((a, b) => natural[a] - natural[b]);
  order.forEach((index, rank) => {
    widths[index] = Math.min(natural[index], left / (order.length - rank));
    left -= widths[index];
  });
  return widths;
}

/** A cell as the screens show it: dates "30 Sep 2026", amounts with two decimals, nothing as "–". */
function show(value: Cell, column: Column) {
  if (value === null) return "–";
  if (typeof value === "number") return formatNumber(value, column.currency || !Number.isInteger(value) ? 2 : 0);
  return column.date ? formatDate(value) : value;
}

const num = (value: number) => value.toFixed(2);
const literal = (encoded: string) => `(${encoded.replace(/[\\()]/g, "\\$&")})`;
const text = (x: number, y: number, encoded: string, size: number, bold = false) =>
  `BT /F${bold ? 2 : 1} ${size} Tf ${num(x)} ${num(y)} Td ${literal(encoded)} Tj ET`;

export function toPdf(file: ReportFile, generated: string) {
  const pages: string[][] = [];
  let ops: string[] = [];
  let y = 0;
  const newPage = () => {
    pages.push((ops = []));
    y = HEIGHT - MARGIN;
  };
  newPage();
  ops.push(text(MARGIN, y - 14, encode(file.title), 14, true), text(MARGIN, y - 30, encode(file.filters), 9), text(MARGIN, y - 43, encode(generated), 9));
  y -= 59;

  for (const section of file.sections) {
    const { columns } = section;
    const right = columns.map((_, index) => section.rows.some((row) => typeof row[index] === "number"));
    const cells = (row: Cell[]) => row.map((value, index) => encode(show(value, columns[index])));
    const header = columns.map((column) => encode(column.header));
    const body = section.rows.length ? section.rows.map(cells) : [[NO_ROWS]];
    const total = section.total ? cells(section.total) : null;
    const all = [header, ...body, ...(total ? [total] : [])];
    const widths = share(
      columns.map((_, index) => Math.max(...all.map((row) => measure(row[index] ?? ""))) + 2 * PAD),
      WIDTH - 2 * MARGIN,
    );
    const edge = MARGIN + widths.reduce((sum, width) => sum + width, 0);
    const layout = (row: string[]) => row.map((cell, index) => wrap(cell, widths[index] - 2 * PAD));
    const height = (lines: string[][]) => 6 + LINE * Math.max(...lines.map((cell) => cell.length));
    // ponytail: a row taller than a page (hundreds of POs in one cell) runs off the page bottom; split rows if that happens.
    const draw = (lines: string[][], bold: boolean, shaded = false) => {
      const h = height(lines);
      if (shaded) ops.push(`0.93 0.94 0.96 rg ${MARGIN} ${num(y - h)} ${num(edge - MARGIN)} ${h} re f 0 g`);
      let x = MARGIN;
      lines.forEach((cell, index) => {
        cell.forEach((line, k) => ops.push(text(right[index] ? x + widths[index] - PAD - measure(line) : x + PAD, y - 10.5 - k * LINE, line, SIZE, bold)));
        x += widths[index];
      });
      y -= h;
      ops.push(`0.8 G 0.5 w ${MARGIN} ${num(y)} m ${num(edge)} ${num(y)} l S`);
    };

    const head = layout(header);
    const rows = [...body.map((row) => ({ lines: layout(row), bold: false })), ...(total ? [{ lines: layout(total), bold: true }] : [])];
    if (y - height(head) - height(rows[0].lines) < MARGIN) newPage();
    draw(head, true, true);
    for (const row of rows) {
      if (y - height(row.lines) < MARGIN) {
        newPage();
        draw(head, true, true);
      }
      draw(row.lines, row.bold);
    }
    y -= 2 * LINE;
  }
  pages.forEach((page, index) => page.push(`0.4 g ${text(MARGIN, 20, encode(`${file.title} · Page ${index + 1} of ${pages.length}`), SIZE)} 0 g`));

  // Objects 1-5: catalog, page tree, the two fonts, document info; then each page and its content stream.
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${6 + 2 * index} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Title ${literal(encode(file.title))} /Producer (MR Garments) >>`,
    ...pages.flatMap((page, index) => {
      const stream = page.join("\n");
      return [
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${WIDTH} ${HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${7 + 2 * index} 0 R >>`,
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      ];
    }),
  ];
  // Every character is one byte, so string offsets are byte offsets.
  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = objects.map((body, index) => {
    const at = pdf.length;
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((at) => `${String(at).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(pdf, (char) => char.charCodeAt(0));
}
