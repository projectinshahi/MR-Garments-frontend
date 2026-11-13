import { readFile } from "node:fs/promises";

import { expect, type Locator, type Page } from "@playwright/test";

// The page's "Download report" menu (src/features/reports/report-actions.tsx): one button opening PDF, Excel and CSV.

export type Format = "PDF" | "Excel" | "CSV";
export const MENU_ITEM: Record<Format, string> = { PDF: "Download PDF", Excel: "Download Excel (.xlsx)", CSV: "Download CSV (.csv)" };

/** The visible "Download report" button (hidden <Activity> routes keep theirs in the DOM). */
export const downloadButton = (page: Page) => page.getByRole("button", { name: "Download report" }).filter({ visible: true }).first();

/** Opens the menu, picks `format` and returns the file's name and its bytes as text (one character per byte). */
export async function downloadReport(page: Page, format: Format, button: Locator = downloadButton(page)) {
  // A menu still playing its 100 ms closing animation takes a click on the button as a click outside it, and the menu
  // then stays shut: wait for the last one to go first (only a script clicks that fast).
  await expect(page.getByRole("menu")).toHaveCount(0);
  await button.click();
  await expect(page.getByRole("menu")).toBeVisible();
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: MENU_ITEM[format] }).click()]);
  return { name: file.suggestedFilename(), text: (await readFile(await file.path())).toString("latin1") };
}
