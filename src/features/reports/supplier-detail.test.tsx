import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { PaymentsPerSupplierReport, SupplierPaymentDetail } from "@/lib/api/reports-types";
import { apiGet } from "@/lib/api/server";
import { formatMoneyList } from "@/lib/formatters";

import { getSupplierPaymentDetail } from "./data/queries";
import { SupplierPaymentsTable } from "./report-widgets";
import {
  DetailUrlProvider,
  OrderStageFilter,
  PaymentDateFilter,
  SupplierLinesList,
  SupplierOrdersList,
  SupplierPaymentsList,
} from "./supplier-detail-tables";

// RPT-5D on the client: the report's links into the detail, the detail's lists (PO links, currencies, empty states) and
// the controls that write its URL. The server screen itself is covered by the e2e tests.

const nav = vi.hoisted(() => {
  const notFound = () => {
    throw new Error("NEXT_NOT_FOUND");
  };
  return { push: vi.fn(), notFound: vi.fn(notFound) };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: nav.push }), notFound: nav.notFound }));
vi.mock("@/lib/api/server", () => ({ apiGet: vi.fn() }));

// jsdom cannot follow links; the hrefs are what is checked. Capture phase, so React still sees every click.
document.addEventListener(
  "click",
  (event) => {
    if ((event.target as Element).closest("a")) event.preventDefault();
  },
  true,
);

beforeEach(() => vi.clearAllMocks());

const FOSHAN = "5f0c7a52-8a0e-4c1e-9d3b-2b9c1f7e4a10";
const YIWU = "0b6c2d1e-7f3a-4b5c-8d9e-1a2b3c4d5e6f";
const BASE = `/reports/payments-per-supplier/${FOSHAN}`;

describe("Payments per supplier report: the way into the detail", () => {
  type SupplierRow = PaymentsPerSupplierReport["suppliers"][number];
  const row = (supplierId: string, supplier: string, currency: SupplierRow["currency"], po: string): SupplierRow => ({
    supplierId,
    supplier,
    currency,
    orders: [po],
    orderValueCny: 100,
    paidCny: 40,
    paidInr: 480,
    balanceCny: 60,
  });
  const rows = [row(FOSHAN, "Foshan Fabrics", "CNY", "PO-2051"), row(YIWU, "Yiwu Trims Ltd.", "CNY", "PO-2052"), row(FOSHAN, "Foshan Fabrics", "USD", "PO-2053")];
  const totals = [
    { currency: "CNY" as const, orders: 2, orderValueCny: 200, paidCny: 80, paidInr: 960, balanceCny: 120 },
    { currency: "USD" as const, orders: 1, orderValueCny: 100, paidCny: 40, paidInr: 480, balanceCny: 60 },
  ];

  it("links each supplier name to its own detail, keeping the report's period and supplier filter", () => {
    const query = `?period=2026-10&supplier=${FOSHAN}`;
    render(<SupplierPaymentsTable rows={rows} totals={totals} query={query} />);
    // Both rows of the two-currency supplier open the same detail.
    expect(screen.getAllByRole("link", { name: "Foshan Fabrics" }).map((link) => link.getAttribute("href"))).toEqual([`${BASE}${query}`, `${BASE}${query}`]);
    expect(screen.getByRole("link", { name: "Yiwu Trims Ltd." })).toHaveAttribute("href", `/reports/payments-per-supplier/${YIWU}${query}`);
  });

  it("opens the same detail on a row click, and only once from the name link", async () => {
    const user = userEvent.setup();
    render(<SupplierPaymentsTable rows={rows} totals={totals} query="" />);
    expect(screen.getByRole("link", { name: "Yiwu Trims Ltd." })).toHaveAttribute("href", `/reports/payments-per-supplier/${YIWU}`);
    for (const po of ["PO-2051", "PO-2053", "PO-2052"]) await user.click(screen.getByText(po));
    expect(nav.push.mock.calls).toEqual([[BASE], [BASE], [`/reports/payments-per-supplier/${YIWU}`]]);
    nav.push.mockClear();
    await user.click(screen.getAllByRole("link", { name: "Foshan Fabrics" })[0]!);
    expect(nav.push).not.toHaveBeenCalled(); // the link navigates; the row's own push is stopped
  });
});

type Detail = SupplierPaymentDetail;
type Payment = Detail["payments"]["rows"][number];
type Order = Detail["orders"]["rows"][number];
type Line = Detail["lines"]["rows"][number];

const page = <T,>(rows: T[], total = rows.length, number = 1) => ({ rows, total, page: number, pageSize: 10 as const });
const payment = (id: string, more: Partial<Payment> = {}): Payment => ({
  id,
  orderId: "o-1",
  po: "PO-2051",
  currency: "CNY",
  kind: "Deposit",
  status: "paid",
  paidOn: "2026-10-01",
  dueDate: null,
  amountCny: 1000,
  rateInr: 12,
  amountInr: 12000,
  mode: "Bank",
  ...more,
});
const order = (po: string, more: Partial<Order> = {}): Order => ({
  id: `id-${po}`,
  po,
  orderDate: "2026-10-01",
  deliveryDate: "2026-11-15",
  stage: 1,
  currency: "CNY",
  quantities: [{ unit: "pcs", quantity: 100 }],
  quantity: 100,
  received: 0,
  unit: "pcs",
  orderValueCny: 1000,
  paidCny: 400,
  balanceCny: 600,
  ...more,
});
const line = (orderLineId: string, more: Partial<Line> = {}): Line => ({
  orderLineId,
  orderId: "o-1",
  po: "PO-2051",
  itemId: "i-1",
  item: "Track pants",
  unit: "pcs",
  quantity: 100,
  rateCny: 2.5,
  amountCny: 250,
  currency: "CNY",
  ...more,
});
const uuid = (n: number) => `${String(n).padStart(8, "0")}-1111-4111-8111-111111111111`;

function renderIn(ui: React.ReactNode, search = "") {
  return render(
    <DetailUrlProvider base={BASE} search={search}>
      {ui}
    </DetailUrlProvider>,
  );
}
/** router.push's arguments for the detail URL with `query`: the scroll position is kept. */
const pushedTo = (query: string) => [query ? `${BASE}?${query}` : BASE, { scroll: false }] as const;
const rowOf = (text: string) => screen.getByText(text).closest("tr")!;

describe("Supplier detail lists: PO links", () => {
  const lists = {
    payments: (linkPos: boolean) => <SupplierPaymentsList list={page([payment(uuid(1))])} linkPos={linkPos} empty="" />,
    orders: (linkPos: boolean) => <SupplierOrdersList list={page([order("PO-2051")])} linkPos={linkPos} today="2026-10-15" empty="" />,
    lines: (linkPos: boolean) => <SupplierLinesList list={page([line("l-1")])} linkPos={linkPos} empty="" />,
  };

  it.each(Object.entries(lists))("%s: the PO opens /orders/<po> for users who may open orders, plain text otherwise", (_, list) => {
    const { unmount } = renderIn(list(true));
    expect(screen.getByRole("link", { name: "PO-2051" })).toHaveAttribute("href", "/orders/PO-2051");
    unmount();
    renderIn(list(false));
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("PO-2051")).toBeInTheDocument();
  });

  it("orders: the row opens the order when linked, the PO link does not navigate twice, and an unlinked row does nothing", async () => {
    const user = userEvent.setup();
    const list = page([order("PO-2051"), order("PO-2052", { orderDate: "2026-09-20" })]);
    const { unmount } = renderIn(<SupplierOrdersList list={list} linkPos today="2026-10-15" empty="" />);
    await user.click(within(rowOf("PO-2052")).getByText("20 Sep 2026"));
    expect(nav.push).toHaveBeenCalledWith("/orders/PO-2052");
    nav.push.mockClear();
    await user.click(screen.getByRole("link", { name: "PO-2051" }));
    expect(nav.push).not.toHaveBeenCalled();
    unmount();

    renderIn(<SupplierOrdersList list={list} linkPos={false} today="2026-10-15" empty="" />);
    await user.click(within(rowOf("PO-2052")).getByText("20 Sep 2026"));
    expect(nav.push).not.toHaveBeenCalled();
  });
});

describe("Supplier detail lists: every amount in its own currency", () => {
  it("payments: amount with the order's symbol, INR at the payment's rate, none while due; the reference is the id's start", () => {
    renderIn(
      <SupplierPaymentsList
        list={page([
          payment(uuid(1)),
          payment(uuid(2), { currency: "USD", amountCny: 50, rateInr: 88, amountInr: 4400, mode: "Wire" }),
          payment(uuid(3), { currency: "INR", amountCny: 1500, rateInr: 1, amountInr: 1500 }),
          payment(uuid(4), { currency: "USD", status: "due", paidOn: null, dueDate: "2026-11-05", amountCny: 30, rateInr: null, amountInr: null, mode: null }),
        ])}
        linkPos={false}
        empty=""
      />,
    );
    const cells = (n: number) => {
      const reference = screen.getByTitle(uuid(n));
      expect(reference).toHaveTextContent(uuid(n).slice(0, 8));
      return within(reference.closest("tr")!).getAllByRole("cell").map((cell) => cell.textContent);
    };
    // Reference, Date, PO, Type, Method, Currency, Amount, INR, Status
    expect(cells(1)).toEqual(["00000001", "1 Oct 2026", "PO-2051", "Deposit", "Bank", "CNY", "¥1,000", "₹12,000", "Paid"]);
    expect(cells(2)).toEqual(["00000002", "1 Oct 2026", "PO-2051", "Deposit", "Wire", "USD", "$50", "₹4,400", "Paid"]);
    expect(cells(3)).toEqual(["00000003", "1 Oct 2026", "PO-2051", "Deposit", "Bank", "INR", "₹1,500", "₹1,500", "Paid"]);
    expect(cells(4)).toEqual(["00000004", "due 5 Nov 2026", "PO-2051", "Deposit", "–", "USD", "$30", "–", "Due"]);
  });

  it("orders: value, paid and balance in the order's currency (an overpayment below zero); pcs and m never added", () => {
    renderIn(
      <SupplierOrdersList
        list={page([
          order("PO-2051", { quantities: [{ unit: "pcs", quantity: 100 }, { unit: "m", quantity: 200 }], orderValueCny: 1850, paidCny: 1500, balanceCny: 350 }),
          order("PO-2052", { currency: "USD", orderValueCny: 200, paidCny: 50, balanceCny: 150 }),
          order("PO-2053", { currency: "INR", orderValueCny: 1500, paidCny: 1000, balanceCny: 500 }),
          order("PO-2054", { orderValueCny: 120, paidCny: 150, balanceCny: -30 }),
        ])}
        linkPos={false}
        today="2026-10-15"
        empty=""
      />,
    );
    const money = (po: string) => within(rowOf(po)).getAllByRole("cell").slice(3, 7).map((cell) => cell.textContent);
    expect(money("PO-2051")).toEqual(["100 pcs · 200 m", "¥1,850", "¥1,500", "¥350"]);
    expect(money("PO-2052")).toEqual(["100 pcs", "$200", "$50", "$150"]);
    expect(money("PO-2053")).toEqual(["100 pcs", "₹1,500", "₹1,000", "₹500"]);
    expect(money("PO-2054")).toEqual(["100 pcs", "¥120", "¥150", "−¥30"]);
  });

  it("products: one row per order line, rate to the cent and total in the order's currency", () => {
    renderIn(
      <SupplierLinesList
        list={page([
          line("l-1", { po: "PO-2052", quantity: 20, rateCny: 3, amountCny: 60 }),
          line("l-2"),
          line("l-3", { po: "PO-2053", item: "Denim jeans", currency: "USD", quantity: 7, rateCny: 17.8575, amountCny: 125 }),
          line("l-4", { po: "PO-2054", item: "Cotton fabric", unit: "m", currency: "INR", quantity: 200, rateCny: 8, amountCny: 1600 }),
        ])}
        linkPos={false}
        empty=""
      />,
    );
    const rows = screen.getAllByRole("row").slice(1);
    // Product, PO, Quantity, Unit rate, Total, Currency
    expect(rows.map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent))).toEqual([
      ["Track pants", "PO-2052", "20 pcs", "¥3.00", "¥60", "CNY"],
      ["Track pants", "PO-2051", "100 pcs", "¥2.50", "¥250", "CNY"],
      ["Denim jeans", "PO-2053", "7 pcs", "$17.86", "$125", "USD"],
      ["Cotton fabric", "PO-2054", "200 m", "₹8.00", "₹1,600", "INR"],
    ]);
  });

  it("KPI tiles: one amount per currency from byCurrency, never added; nothing yet shows the supplier's currency", () => {
    const byCurrency = [
      { currency: "CNY" as const, amount: 2090 },
      { currency: "USD" as const, amount: 131.98 },
      { currency: "INR" as const, amount: -30 },
    ];
    expect(formatMoneyList(byCurrency, {}, "USD")).toBe("¥2,090 · $132 · −₹30");
    expect(formatMoneyList([], {}, "USD")).toBe("$0");
  });
});

describe("Supplier detail lists: paging and empty states", () => {
  // Each list on page `at` of 17 rows: 10 on page 1, 7 on page 2.
  const ten = Array.from({ length: 10 }, (_, index) => uuid(index + 1));
  const pageOf = <T,>(rows: T[], at: number) => page(at === 1 ? rows : rows.slice(0, 7), 17, at);
  const lists = {
    payments: (at: number) => <SupplierPaymentsList list={pageOf(ten.map((id) => payment(id)), at)} linkPos={false} empty="" />,
    orders: (at: number) => <SupplierOrdersList list={pageOf(ten.map((po) => order(po)), at)} linkPos={false} today="2026-10-15" empty="" />,
    "order lines": (at: number) => <SupplierLinesList list={pageOf(ten.map((id) => line(id)), at)} linkPos={false} empty="" />,
  };

  it.each([
    ["payments", "paymentsPage"],
    ["orders", "ordersPage"],
    ["order lines", "linesPage"],
  ] as const)("%s: the pager shows the URL's page and writes ?%s, keeping every other parameter", async (label, param) => {
    const user = userEvent.setup();
    const search = "period=2026-10&supplier=x&stage=2";
    const first = renderIn(lists[label](1), search);
    expect(screen.getByText(`Showing 1 to 10 of 17 ${label}`)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(nav.push).toHaveBeenLastCalledWith(...pushedTo(`${search}&${param}=2`));
    first.unmount();

    renderIn(lists[label](2), `${search}&${param}=2`);
    expect(screen.getByText(`Showing 11 to 17 of 17 ${label}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("button", { name: "Page 1" }));
    expect(nav.push).toHaveBeenLastCalledWith(...pushedTo(search));
  });

  it("no records at all, or none for these filters: the section's own empty text, and no pager", () => {
    const { unmount } = renderIn(<SupplierPaymentsList list={page([])} linkPos={false} empty="No payments yet." />);
    expect(screen.getByText("No payments yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Table pagination" })).toBeNull();
    unmount();
    renderIn(<SupplierOrdersList list={page([])} linkPos today="2026-10-15" empty="No orders at this stage." />, "stage=6");
    expect(screen.getByText("No orders at this stage.")).toBeInTheDocument();
  });

  it("a page past the end says so and goes back to page 1 of that list only", async () => {
    renderIn(<SupplierLinesList list={page([], 14, 3)} linkPos={false} empty="No order lines yet." />, "period=2026-10&linesPage=3&paymentsPage=2");
    expect(screen.getByText("No order lines on page 3.")).toBeInTheDocument();
    expect(screen.queryByText("No order lines yet.")).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: "Go to page 1" }));
    expect(nav.push).toHaveBeenCalledWith(...pushedTo("period=2026-10&paymentsPage=2"));
  });
});

describe("Supplier detail filters", () => {
  it("payment dates: each complete date writes the URL and resets the payments page; Clear removes both", async () => {
    renderIn(<PaymentDateFilter />, "period=2026-10&paymentsPage=3&ordersPage=2");
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-10-05" } });
    expect(nav.push).toHaveBeenLastCalledWith(...pushedTo("period=2026-10&ordersPage=2&paymentFrom=2026-10-05"));
    // The second change builds on the first while the page reloads.
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-10-20" } });
    expect(nav.push).toHaveBeenLastCalledWith(...pushedTo("period=2026-10&ordersPage=2&paymentFrom=2026-10-05&paymentTo=2026-10-20"));
    expect(screen.getByLabelText("To")).toHaveAttribute("min", "2026-10-05");
    expect(screen.getByLabelText("From")).toHaveAttribute("max", "2026-10-20");
    await userEvent.setup().click(screen.getByRole("button", { name: "Clear" }));
    expect(nav.push).toHaveBeenLastCalledWith(...pushedTo("period=2026-10&ordersPage=2"));
  });

  it("payment dates: a year still being typed waits; emptying a field removes it", () => {
    renderIn(<PaymentDateFilter />, "paymentFrom=2026-10-05&paymentTo=2026-10-20");
    expect(screen.getByLabelText("From")).toHaveValue("2026-10-05");
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "0002-10-20" } });
    expect(nav.push).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "" } });
    expect(nav.push).toHaveBeenLastCalledWith(...pushedTo("paymentTo=2026-10-20"));
  });

  it("stage: picking one writes ?stage and resets the orders page only; All stages removes it", async () => {
    const user = userEvent.setup();
    const { unmount } = renderIn(<OrderStageFilter />, "period=2026-10&ordersPage=2&paymentsPage=2");
    await user.click(screen.getByRole("button", { name: "Stage: All stages" }));
    await user.click(screen.getByRole("menuitemradio", { name: "3. Container loading" }));
    expect(nav.push).toHaveBeenLastCalledWith(...pushedTo("period=2026-10&paymentsPage=2&stage=3"));
    unmount();

    renderIn(<OrderStageFilter />, "stage=3&ordersPage=2");
    await user.click(screen.getByRole("button", { name: "Stage: 3. Container loading" }));
    await user.click(screen.getByRole("menuitemradio", { name: "All stages" }));
    expect(nav.push).toHaveBeenLastCalledWith(...pushedTo(""));
  });

  it("stage: an unknown stage in the URL shows All stages", () => {
    renderIn(<OrderStageFilter />, "stage=9");
    expect(screen.getByRole("button", { name: "Stage: All stages" })).toBeInTheDocument();
  });
});

describe("getSupplierPaymentDetail", () => {
  const get = vi.mocked(apiGet);
  const data = { supplier: { id: FOSHAN } } as Detail;

  it("asks the API for this supplier with the strict query, and keeps the report's filters for the way back", async () => {
    get.mockResolvedValue(data);
    const search = { period: "2026-10", supplier: FOSHAN, paymentsPage: "2", stage: "x" };
    const page = await getSupplierPaymentDetail(FOSHAN, search);
    expect(get).toHaveBeenCalledWith(`/reports/payments-per-supplier/${FOSHAN}?from=2026-10-01&to=2026-10-31&paymentsPage=2`);
    expect(page).toMatchObject({ data, query: `?period=2026-10&supplier=${FOSHAN}`, search: `period=2026-10&supplier=${FOSHAN}&paymentsPage=2&stage=x` });
    await getSupplierPaymentDetail("../users?x=1", {});
    expect(get).toHaveBeenLastCalledWith("/reports/payments-per-supplier/..%2Fusers%3Fx%3D1");
  });

  it("an unknown supplier (404) is the not-found page; other errors go to the error page", async () => {
    get.mockRejectedValueOnce(new ApiError(404, "not_found", "Supplier not found."));
    await expect(getSupplierPaymentDetail(FOSHAN, {})).rejects.toThrow("NEXT_NOT_FOUND");
    expect(nav.notFound).toHaveBeenCalledOnce();
    const forbidden = new ApiError(403, "forbidden", "You don't have access to do that.");
    get.mockRejectedValueOnce(forbidden);
    await expect(getSupplierPaymentDetail(FOSHAN, {})).rejects.toBe(forbidden);
    expect(nav.notFound).toHaveBeenCalledOnce();
  });
});
