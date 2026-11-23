import { balanceLabel, round2 } from "@/features/payments/money";
import { amountsText, type Column, money, perCurrency, type ReportFile, summarySection } from "@/features/reports/report-files";
import type { SupplierRow } from "@/lib/api/types";
import { formatDateTime, sumByCurrency } from "@/lib/formatters";

// Supplier List report download (backend docs/report-downloads.md): every supplier the list's search, status and
// country filters match, in the table's sort order, with the full profile, the preferred currency and its exchange rate
// now (what new orders and deposits will save; each order keeps its own), the active POs, this year's purchase value
// and the signed supplier ledger balance (+ available with the supplier, − payable; backend docs/unified-ledger.md).
// Amounts are one per currency and never added together: as text on the profile sheet, as numbers in the per-currency
// table. A held account (pending review) has no balance and is named instead.

const text = (header: string): Column => ({ header });
/** "Payable to supplier CNY 1,200.00", "Available with supplier USD 300.00", "Settled (INR)" (codes: the PDF has no ₹). */
const inWords = (t: SupplierRow["balance"][number]) =>
  t.amount === 0 ? `${balanceLabel(0)} (${t.currency})` : `${balanceLabel(t.amount)} ${amountsText([{ currency: t.currency, amount: Math.abs(t.amount) }])}`;
/** Each balance in words, then any held currency (no figure while pending review). MD-1 and SUP-2 rows. */
export const balanceText = (s: Pick<SupplierRow, "balance" | "heldCurrencies">) => [...s.balance.map(inWords), ...s.heldCurrencies.map((c) => `${c} pending review`)].join("; ") || null;

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
      "Purchase value is this year's order value: received quantity x rate. The supplier balance is the signed ledger balance: positive is money available with the supplier, negative is payable to the supplier. Amounts in different currencies are never added together.",
    ],
    sections: [
      summarySection([
        ["Suppliers", rows.length],
        ["Active", rows.filter((s) => s.status === "Active").length],
        ["Inactive", rows.filter((s) => s.status !== "Active").length],
        ["Active POs", rows.reduce((sum, s) => sum + s.openPos, 0)],
        // A held account's open orders: never in Active POs, named apart while there are any.
        ...(rows.some((s) => s.heldOpenPos) ? [["Active POs pending review (held account, not counted)", rows.reduce((sum, s) => sum + (s.heldOpenPos ?? 0), 0)] as [string, number]] : []),
        ["Purchase value (this year)", amountsText(sumByCurrency(amounts, (a) => a.currency, (a) => a.purchase))],
        ["Payable to suppliers", amountsText(sumByCurrency(amounts.filter((a) => a.balance < 0), (a) => a.currency, (a) => -a.balance))],
        ["Available with suppliers", amountsText(sumByCurrency(amounts.filter((a) => a.balance > 0), (a) => a.currency, (a) => a.balance))],
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
          // A held account's open orders, never in Active POs (as the list's "+N pending review").
          text("Active POs pending review"),
          text("Purchase value (this year)"),
          text("Supplier balance"),
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
          s.heldOpenPos ?? 0,
          amountsText(s.ytdValue),
          balanceText(s),
          s.notes || null,
        ]),
      },
      ...perCurrency(amounts).map(([currency, list]) => ({
        sheet: "Purchases and Balances",
        title: `Purchases and balances (${currency})`,
        // The two directions apart, each unsigned, so a total never nets what is payable against what is available.
        columns: [
          text("Supplier code"),
          text("Supplier name"),
          money("Purchase value (this year)", currency),
          money("Payable to supplier", currency),
          money("Available with supplier", currency),
        ],
        rows: list.map((a) => [a.supplier.code || null, a.supplier.name, a.purchase, Math.max(0, -a.balance), Math.max(0, a.balance)]),
        total: list.length
          ? [
              "Total",
              null,
              round2(list.reduce((sum, a) => sum + a.purchase, 0)),
              round2(list.reduce((sum, a) => sum + Math.max(0, -a.balance), 0)),
              round2(list.reduce((sum, a) => sum + Math.max(0, a.balance), 0)),
            ]
          : undefined,
      })),
    ],
  };
}
