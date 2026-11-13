import { amountsText, type Column, money, perCurrency, type ReportFile, summarySection } from "@/features/reports/report-files";
import type { SupplierRow } from "@/lib/api/types";
import { formatDateTime, sumByCurrency } from "@/lib/formatters";

// Supplier List report download (backend docs/report-downloads.md): every supplier the list's search, status and
// country filters match, in the table's sort order, with the full profile, the preferred currency and its exchange rate
// now (what new orders and deposits will save; each order keeps its own), the active POs, this year's purchase value
// and the outstanding balance. Amounts are one per order currency and never added together: as text on the profile
// sheet, as numbers in the per-currency table.

const text = (header: string): Column => ({ header });

export function suppliersListFile(rows: SupplierRow[], filters: string, today: string): ReportFile {
  const amounts = rows.flatMap((s) => {
    const currencies = [...new Set([...s.ytdValue, ...s.balance].map((t) => t.currency))];
    const of = (totals: SupplierRow["balance"], currency: string) => totals.find((t) => t.currency === currency)?.amount ?? 0;
    return currencies.map((currency) => ({ supplier: s, currency, purchase: of(s.ytdValue, currency), balance: of(s.balance, currency) }));
  });
  return {
    title: "Suppliers",
    filename: `suppliers-${today}`,
    filters,
    notes: [
      "Exchange rate: the supplier's rate now (INR per 1 unit of its currency), used by new orders and deposits; each order and deposit keeps the rate saved on it.",
      "Purchase value is this year's order value; the balance is what is still owed over every order. Amounts in different currencies are never added together.",
    ],
    sections: [
      summarySection([
        ["Suppliers", rows.length],
        ["Active", rows.filter((s) => s.status === "Active").length],
        ["Inactive", rows.filter((s) => s.status !== "Active").length],
        ["Active POs", rows.reduce((sum, s) => sum + s.openPos, 0)],
        ["Purchase value (this year)", amountsText(sumByCurrency(amounts, (a) => a.currency, (a) => a.purchase))],
        ["Outstanding balance", amountsText(sumByCurrency(amounts, (a) => a.currency, (a) => a.balance))],
      ]),
      {
        sheet: "Suppliers",
        title: "Supplier list",
        columns: [
          text("Supplier code"),
          text("Supplier name"),
          text("Status"),
          text("Country"),
          text("City"),
          text("State / Province"),
          text("Postal code"),
          text("Address"),
          text("Contact person"),
          text("Phone"),
          text("Email"),
          text("Payment terms"),
          text("Tax / registration number"),
          text("Preferred currency"),
          { header: "Current exchange rate (INR per 1)", rate: true },
          text("Rate last updated"),
          text("Active POs"),
          text("Purchase value (this year)"),
          text("Outstanding balance"),
          text("Notes"),
        ],
        rows: rows.map((s) => [
          s.code || null,
          s.name,
          s.status,
          s.country || null,
          s.city || null,
          s.state || null,
          s.postalCode || null,
          s.address || null,
          s.contactPerson || null,
          s.phone || null,
          s.email || null,
          s.paymentTerms || null,
          s.taxNumber || null,
          s.currency,
          s.exchangeRate,
          s.rateUpdatedAt ? formatDateTime(s.rateUpdatedAt) : null,
          s.openPos,
          amountsText(s.ytdValue),
          amountsText(s.balance),
          s.notes || null,
        ]),
      },
      ...perCurrency(amounts).map(([currency, list]) => ({
        sheet: "Purchases and Balances",
        title: `Purchases and balances (${currency})`,
        columns: [text("Supplier code"), text("Supplier name"), money("Purchase value (this year)", currency), money("Outstanding balance", currency)],
        rows: list.map((a) => [a.supplier.code || null, a.supplier.name, a.purchase, a.balance]),
        total: list.length
          ? ["Total", null, Math.round(list.reduce((sum, a) => sum + a.purchase, 0) * 100) / 100, Math.round(list.reduce((sum, a) => sum + a.balance, 0) * 100) / 100]
          : undefined,
      })),
    ],
  };
}
