// CSV of a report's rows (report-files.ts saves it).

export type CsvCell = string | number | null;

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
