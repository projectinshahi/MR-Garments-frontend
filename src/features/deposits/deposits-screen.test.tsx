import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { DepositsResponse, SupplierStatement } from "@/lib/api/deposits-types";

import type { DepositsData, StatementData } from "./data/queries";
import { toRows } from "./deposits-logic";
import { DepositsScreen } from "./deposits-screen";
import { StatementScreen } from "./statement-screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/deposits",
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(),
}));
vi.mock("@/lib/api/server", () => ({ apiGet: vi.fn() }));
vi.mock("@/lib/session", () => ({ getMe: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn(), delete: vi.fn() } }));

const api: DepositsResponse = {
  orderDeposits: [
    { id: "p1", orderId: "o1", po: "PO-3001", supplierId: "s1", supplier: "Foshan Fabrics", payee: "Sino Freight", payeeRole: "agent", currency: "CNY", amountCny: 300, status: "paid", paidOn: "2026-10-21", dueDate: null, rateInr: 12, amountInr: 3600, mode: "Bank transfer", reference: "UTR 9", notes: "Half" },
  ],
  orderObligations: [],
  supplierDeposits: [
    { id: "d2", supplierId: "s1", supplier: "Foshan Fabrics", direction: "receive", currency: "CNY", exchangeRate: null, amount: 500, settled: 100, pending: 400, status: "partly settled", openedOn: "2026-10-10", reference: "Mould", notes: "", transactions: 1 },
    { id: "d1", supplierId: "s2", supplier: "Hangzhou Knits", direction: "give", currency: "USD", exchangeRate: null, amount: 1000, settled: 0, pending: 1000, status: "open", openedOn: "2026-10-01", reference: "", notes: "", transactions: 0 },
  ],
  suppliers: [
    { id: "s1", name: "Foshan Fabrics" },
    { id: "s2", name: "Hangzhou Knits" },
  ],
};
const data = (access: Partial<DepositsData> = {}): DepositsData => ({ rows: toRows(api), suppliers: api.suppliers, today: "2026-11-10", canEnter: false, canDelete: false, linkPo: true, ...access });
// The KPI tile's label is a <p>; a deposit block's fact labels ("Received") are <dt>s.
const kpi = (label: string) => screen.getByText(label, { selector: "p" }).nextSibling;
const rowsOf = (table: HTMLElement) => within(table).getAllByRole("row").slice(1);

describe("DepositsScreen", () => {
  it("All: both lists in one table with kinds, pills and links, and the cards per currency from the rows shown", () => {
    render(<DepositsScreen data={data()} view="all" />);
    expect(screen.getByRole("heading", { level: 1, name: "Deposits" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Deposits views" }).querySelector("[aria-current=page]")).toHaveTextContent("All deposits");
    const rows = rowsOf(screen.getByRole("table"));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Order deposit");
    expect(within(rows[0]!).getByRole("link", { name: "PO-3001" })).toHaveAttribute("href", "/orders/PO-3001");
    expect(within(rows[0]!).getByText("Paid")).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent("To receive");
    expect(within(rows[1]!).getByText("Partly settled")).toBeInTheDocument();
    expect(within(rows[1]!).getByRole("link", { name: "Details" })).toHaveAttribute("href", "/deposits/suppliers/s1");
    expect(rows[2]).toHaveTextContent("To give");
    // "Paid to" names who was paid: the agent for the order deposit, the supplier for a deposit to give, nothing for one to receive.
    expect(within(rows[0]!).getAllByRole("cell")[3]).toHaveTextContent("Sino Freight");
    expect(within(rows[1]!).getAllByRole("cell")[3]).toHaveTextContent("–");
    expect(within(rows[2]!).getAllByRole("cell")[3]).toHaveTextContent("Hangzhou Knits");
    // Payables: the ¥300 order deposit and the $1,000 to give (paid ¥300; pending $1,000). Receivables: ¥500, ¥100 received, ¥400 pending.
    expect(kpi("Deposits to pay")).toHaveTextContent("¥300 · $1,000");
    expect(kpi("Deposits to pay")!.nextSibling).toHaveTextContent("2 deposits");
    expect(kpi("Paid")).toHaveTextContent("¥300");
    expect(kpi("Pending to pay")).toHaveTextContent("$1,000");
    expect(kpi("To receive")).toHaveTextContent("¥400");
    expect(kpi("To receive")!.nextSibling).toHaveTextContent("received ¥100 of ¥500 · 1 deposit");
    expect(screen.getByRole("button", { name: "Export Excel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export PDF" })).toBeInTheDocument();
  });

  it("Pending and Paid keep their rows; filters narrow the table and the cards follow", async () => {
    const user = userEvent.setup();
    const pending = render(<DepositsScreen data={data()} view="pending" />);
    expect(rowsOf(screen.getByRole("table")).map((row) => row.textContent)).toEqual([expect.stringContaining("To receive"), expect.stringContaining("To give")]);
    expect(kpi("Pending to pay")).toHaveTextContent("$1,000");
    expect(kpi("To receive")).toHaveTextContent("¥400");
    pending.unmount();

    render(<DepositsScreen data={data()} view="paid" />);
    expect(rowsOf(screen.getByRole("table"))).toHaveLength(1);
    expect(screen.getByRole("table")).toHaveTextContent("PO-3001");
    await user.type(screen.getByRole("searchbox", { name: "Search PO" }), "9999");
    expect(screen.getByText("No deposits match these filters.")).toBeInTheDocument();
    expect(kpi("Deposits to pay")).toHaveTextContent("¥0");
    expect(kpi("Deposits to pay")!.nextSibling).toHaveTextContent("0 deposits");
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(rowsOf(screen.getByRole("table"))).toHaveLength(1);
  });

  it("Pending: an order's deposit requirement is one Partly paid row with its pending figure and payment count, linking to the order's Payments tab", async () => {
    const user = userEvent.setup();
    // PO-3001 asked for ¥1,000 and has the ¥300 payment above: the obligation stands for it, the payment is not listed again.
    const obligation: DepositsResponse["orderObligations"][number] = { orderId: "o1", po: "PO-3001", supplierId: "s1", supplier: "Foshan Fabrics", currency: "CNY", requiredCny: 1000, paidCny: 300, pendingCny: 700, status: "partly", lastPaidOn: "2026-10-21", payments: 1 };
    render(<DepositsScreen data={data({ rows: toRows({ ...api, orderObligations: [obligation] }) })} view="pending" />);
    const rows = rowsOf(screen.getByRole("table"));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Order deposit1 payment");
    expect(within(rows[0]!).getAllByRole("cell").slice(4, 9).map((cell) => cell.textContent)).toEqual(["¥1,000", "CNY", "¥300", "¥700", "21 Oct"]);
    expect(within(rows[0]!).getByText("Partly paid")).toBeInTheDocument();
    expect(within(rows[0]!).getByRole("link", { name: "Details" })).toHaveAttribute("href", "/orders/PO-3001/payments");
    // Counted once: ¥1,000 to pay and $1,000 to give; ¥300 paid; ¥700 and $1,000 pending.
    expect(kpi("Deposits to pay")).toHaveTextContent("¥1,000 · $1,000");
    expect(kpi("Paid")).toHaveTextContent("¥300");
    expect(kpi("Pending to pay")).toHaveTextContent("¥700 · $1,000");
    // The Status filter offers Pending's statuses, Partly paid among them.
    await user.click(screen.getByRole("button", { name: "Status: All statuses" }));
    expect(screen.getAllByRole("menuitemradio").map((option) => option.textContent)).toEqual(["All statuses", "Due", "Partly paid", "Open", "Partly settled"]);
    await user.click(screen.getByRole("menuitemradio", { name: "Partly paid" }));
    expect(rowsOf(screen.getByRole("table"))).toHaveLength(1);
  });

  it("All: a shipping agent's deposit on an order with a requirement is listed as the agent's, next to the obligation row", () => {
    // PO-3001 asked for ¥1,000 and paid the supplier nothing yet; its ¥300 deposit went to Sino Freight (sea freight), so it stays listed.
    const obligation: DepositsResponse["orderObligations"][number] = { orderId: "o1", po: "PO-3001", supplierId: "s1", supplier: "Foshan Fabrics", currency: "CNY", requiredCny: 1000, paidCny: 0, pendingCny: 1000, status: "due", lastPaidOn: null, payments: 0 };
    render(<DepositsScreen data={data({ rows: toRows({ ...api, orderObligations: [obligation] }) })} view="all" />);
    const rows = rowsOf(screen.getByRole("table"));
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent("Order deposit0 payments");
    expect(within(rows[0]!).getByText("Due")).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent("Order depositto shipping agent");
    expect(rows[1]).toHaveTextContent("Sino Freight");
    expect(within(rows[1]!).getByText("Paid")).toBeInTheDocument();
  });

  it("Suppliers: one line per supplier with the six figures apart, linking to the statement", () => {
    render(<DepositsScreen data={data()} view="suppliers" />);
    const rows = rowsOf(screen.getByRole("table"));
    expect(rows).toHaveLength(2);
    const cells = (row: HTMLElement) => within(row).getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells(rows[0]!)).toEqual(["Foshan Fabrics", "–", "–", "–", "¥500", "¥100", "¥400", "Statement"]);
    expect(cells(rows[1]!)).toEqual(["Hangzhou Knits", "$1,000", "$0", "$1,000", "–", "–", "–", "Statement"]);
    expect(within(rows[0]!).getByRole("link", { name: "Statement of Foshan Fabrics" })).toHaveAttribute("href", "/deposits/suppliers/s1");
    // Supplier deposits only: the $1,000 to give, and the ¥500 to receive.
    expect(kpi("Deposits to pay")).toHaveTextContent("$1,000");
    expect(kpi("Deposits to pay")!.nextSibling).toHaveTextContent("1 deposit");
    expect(kpi("To receive")!.nextSibling).toHaveTextContent("received ¥100 of ¥500 · 1 deposit");
    expect(screen.queryByRole("searchbox", { name: "Search PO" })).not.toBeInTheDocument();
  });

  it("says there are none yet when the API returns nothing", () => {
    render(<DepositsScreen data={data({ rows: [] })} view="all" />);
    expect(screen.getByText("No deposits yet.")).toBeInTheDocument();
    expect(kpi("Deposits to pay")).toHaveTextContent("¥0");
    expect(kpi("To receive")!.nextSibling).toHaveTextContent("received ¥0 of ¥0 · 0 deposits");
  });

  it("without Orders access, an order deposit's PO is plain text and the row has no Details link; statement links stay", () => {
    render(<DepositsScreen data={data({ rows: toRows(api, false), linkPo: false })} view="all" />);
    const rows = rowsOf(screen.getByRole("table"));
    expect(within(rows[0]!).queryByRole("link")).not.toBeInTheDocument();
    expect(rows[0]).toHaveTextContent("PO-3001");
    expect(within(rows[1]!).getByRole("link", { name: "Details" })).toHaveAttribute("href", "/deposits/suppliers/s1");
  });
});

const statement: SupplierStatement = {
  supplier: { id: "s1", name: "Foshan Fabrics", contactPerson: "Mr. Chen Hao", phone: "+86 137", city: "Foshan", currency: "CNY", status: "Active" },
  summary: [
    { currency: "CNY", direction: "give", amount: 1000, settled: 300, pending: 700 },
    { currency: "CNY", direction: "receive", amount: 500, settled: 500, pending: 0 },
  ],
  deposits: [
    {
      id: "d2", supplierId: "s1", supplier: "Foshan Fabrics", direction: "receive", currency: "CNY", exchangeRate: null, amount: 500, settled: 500, pending: 0, status: "settled", openedOn: "2026-10-10", reference: "Mould", notes: "", transactions: [
        { id: "t3", paidOn: "2026-10-12", amount: 500, mode: "Cash", reference: "", notes: "" },
      ],
    },
    {
      id: "d1", supplierId: "s1", supplier: "Foshan Fabrics", direction: "give", currency: "CNY", exchangeRate: null, amount: 1000, settled: 300, pending: 700, status: "partly settled", openedOn: "2026-10-01", reference: "", notes: "Tooling", transactions: [
        { id: "t2", paidOn: "2026-10-20", amount: 100, mode: "Cash", reference: "", notes: "" },
        { id: "t1", paidOn: "2026-10-05", amount: 200, mode: "Bank transfer", reference: "TXN 1", notes: "" },
      ],
    },
  ],
};
const statementData = (access: Partial<StatementData> = {}): StatementData => ({ statement, today: "2026-11-10", canEnter: false, canDelete: false, linkPo: true, ...access });

describe("StatementScreen", () => {
  it("shows the six figures apart, each deposit with its transactions oldest first, and no actions below Enter", () => {
    render(<StatementScreen data={statementData()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Foshan Fabrics" })).toBeInTheDocument();
    expect(kpi("To give")).toHaveTextContent("¥1,000");
    expect(kpi("Given")).toHaveTextContent("¥300");
    expect(kpi("Pending to give")).toHaveTextContent("¥700");
    expect(kpi("To receive")).toHaveTextContent("¥500");
    expect(kpi("Received")).toHaveTextContent("¥500");
    expect(kpi("Pending to receive")).toHaveTextContent("¥0");
    const blocks = screen.getAllByRole("article");
    expect(blocks.map((block) => within(block).getByRole("heading", { level: 3 }).textContent)).toEqual(["To receive · ¥500", "To give · ¥1,000"]);
    expect(within(blocks[1]!).getByRole("list", { name: "Payments" })).toHaveTextContent("1. 5 Oct 2026 · ¥200 · Bank transfer · TXN 12. 20 Oct 2026 · ¥100 · Cash");
    expect(within(blocks[0]!).getByRole("list", { name: "Receipts" })).toHaveTextContent("1. 12 Oct 2026 · ¥500 · Cash");
    expect(screen.queryByRole("button", { name: "+ New deposit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Record (payment|receipt)$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Delete / })).not.toBeInTheDocument();
  });

  it("offers New deposit and Record payment on open deposits with Enter, and Delete with Full", async () => {
    const user = userEvent.setup();
    render(<StatementScreen data={statementData({ canEnter: true, canDelete: true })} />);
    expect(screen.getByRole("button", { name: "+ New deposit" })).toBeInTheDocument();
    // Only the deposit with something pending can be settled.
    expect(screen.getAllByRole("button", { name: /^Record (payment|receipt)$/ }).map((b) => b.textContent)).toEqual(["Record payment"]);
    expect(screen.getAllByRole("button", { name: /^Delete / }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Delete deposit of 10 Oct 2026, ¥500",
      "Delete receipt of 12 Oct 2026, ¥500",
      "Delete deposit of 1 Oct 2026, ¥1,000",
      "Delete payment of 5 Oct 2026, ¥200",
      "Delete payment of 20 Oct 2026, ¥100",
    ]);
    // A deposit with transactions can't go: Delete explains instead of asking.
    await user.click(screen.getByRole("button", { name: "Delete deposit of 1 Oct 2026, ¥1,000" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Can't delete deposit" });
    expect(dialog).toHaveTextContent("This deposit has 2 transactions, so it can't be deleted.");
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    // A payment's confirmation names what changes.
    await user.click(screen.getByRole("button", { name: "Delete payment of 5 Oct 2026, ¥200" }));
    const ask = await screen.findByRole("alertdialog", { name: "Delete Payment?" });
    expect(ask).toHaveTextContent("Settled goes from ¥300 to ¥100, and pending from ¥700 to ¥900.");
  });
});
