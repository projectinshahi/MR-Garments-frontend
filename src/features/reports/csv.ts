// CSV export of a report, built in the browser from the data already on the page (no library, nothing stored).

export type CsvCell = string | number | null;
export type CsvFile = { filename: string; rows: CsvCell[][] };

/**
 * One cell: numbers as they are, text quoted when it holds a comma, quote or line break. Text that a spreadsheet would
 * run as a formula (=, +, -, @, tab, return) gets a leading apostrophe, as names and remarks are typed by users.
 */
function cell(value: CsvCell) {
  if (value === null) return "";
  if (typeof value === "number") return String(value);
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** RFC 4180 lines (CRLF). */
export const toCsv = (rows: CsvCell[][]) => rows.map((row) => row.map(cell).join(",")).join("\r\n");

/** Saves the rows as a UTF-8 file (with a byte-order mark, so Excel reads ₹ and ¥). */
export function downloadCsv({ filename, rows }: CsvFile) {
  const url = URL.createObjectURL(new Blob([`﻿${toCsv(rows)}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url));
}
