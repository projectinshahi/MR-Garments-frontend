import { type APIRequestContext, type APIResponse, test as base, expect, type Locator, type Page, type PlaywrightWorkerArgs } from "@playwright/test";

import type { ContainerState, CreatePaymentBody, OrderDetail, OrderOptions, ReceiptOptions } from "../src/lib/api/types";
import { MANAGEMENT_STATE } from "./sessions";

// Live five-tab specs (Orders, Payments, Calendar, Receiving, Containers): the records a test needs are created inside
// the test through the API as Management (`api` fixture), so tests never depend on each other or on an empty database.
// Spec files share one test database during a run, so tests find their own rows by PO or container number.

/** Today in India (YYYY-MM-DD), as the app and the API measure it; `days` moves it. */
export const today = (days = 0) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(Date.now() + days * 86_400_000);

/** `iso` moved by `days`. */
export const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** A unique container number: TEST + 7 random digits. */
export const containerNumber = () => `TEST${String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0")}`;

/** An input found by its label, ignoring copies kept hidden by <Activity> on other visited routes. */
export const field = (scope: Page | Locator, label: string | RegExp) => scope.getByLabel(label).filter({ visible: true });

// The app's formats (src/lib/formatters.ts): Indian digit grouping, "27 Oct", "27 Oct 2026".
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const parts = (iso: string) => iso.split("-").map(Number) as [number, number, number];
export const num = (value: number, decimals = 0) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
export const inr = (value: number) => `₹${num(value)}`;
export const cny = (value: number) => `¥${num(value)}`;
export const shortDate = (iso: string) => `${parts(iso)[2]} ${MONTHS[parts(iso)[1] - 1]}`;
export const longDate = (iso: string) => `${shortDate(iso)} ${parts(iso)[0]}`;
/** "October 2026" for any date in that month. */
export const monthTitle = (iso: string) => `${LONG_MONTHS[parts(iso)[1] - 1]} ${parts(iso)[0]}`;

const exactly = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
/** The value (dd) next to a label (dt) in a key-value list. */
export const kv = (scope: Page | Locator, label: string) =>
  scope.getByRole("term").filter({ hasText: exactly(label), visible: true }).locator("xpath=following-sibling::dd[1]");
/** A KPI card (label, value, sub line) found by its label paragraph. */
export const kpi = (page: Page, label: string) => page.locator("p").filter({ hasText: exactly(label), visible: true }).locator("xpath=..");
/** A toast (sonner) with this text. */
export const toast = (page: Page, text: string | RegExp) => page.locator("[data-sonner-toast]").filter({ hasText: text });

type LineInput = { item: string; quantity: number; rateCny: number };
type DepositInput = { payee?: string; payeeRole?: "supplier" | "agent"; amountCny: number; paidOn?: string; rateInr: number; mode?: string };
export type OrderInput = { supplier?: string; orderDate?: string; deliveryDate?: string; lines?: LineInput[]; deposits?: DepositInput[] };
export type CreatedOrder = { id: string; po: string };

async function json<T>(response: APIResponse, status: number): Promise<T> {
  expect(response.status(), `${response.url()}: ${await response.text()}`).toBe(status);
  return (await response.json()) as T;
}

export class Api {
  constructor(readonly request: APIRequestContext) {}

  get = async <T>(path: string) => json<T>(await this.request.get(`/api/v1${path}`), 200);
  /** Raw POST, for tests that expect a refusal. */
  post = (path: string, data: unknown) => this.request.post(`/api/v1${path}`, { data });
  patch = (path: string, data: unknown) => this.request.patch(`/api/v1${path}`, { data });

  options = () => this.get<OrderOptions>("/orders/options");
  order = (po: string) => this.get<OrderDetail>(`/orders/${po}`);

  /** ORD-3 with defaults: Foshan Fabrics, 100 pcs Denim jeans at ¥10, ordered today, due in 30 days. */
  async createOrder(input: OrderInput = {}): Promise<CreatedOrder> {
    const options = await this.options();
    const supplierName = input.supplier ?? "Foshan Fabrics";
    const supplier = options.suppliers.find((s) => s.name === supplierName);
    expect(supplier, supplierName).toBeTruthy();
    const orderDate = input.orderDate ?? today();
    const lines = (input.lines ?? [{ item: "Denim jeans", quantity: 100, rateCny: 10 }]).map((line) => {
      const item = options.items.find((i) => i.name === line.item);
      expect(item, line.item).toBeTruthy();
      return { itemId: item!.id, quantity: line.quantity, rateCny: line.rateCny };
    });
    const deposits = (input.deposits ?? []).map((d) => ({
      payee: d.payee ?? supplierName,
      payeeRole: d.payeeRole ?? "supplier",
      amountCny: d.amountCny,
      paidOn: d.paidOn ?? orderDate,
      rateInr: d.rateInr,
      mode: d.mode ?? "Bank transfer",
    }));
    const body = { supplierId: supplier!.id, orderDate, deliveryDate: input.deliveryDate ?? addDays(orderDate, 30), lines, deposits };
    const { order } = await json<{ order: CreatedOrder }>(await this.post("/orders", body), 201);
    return order;
  }

  /** PAY-2 for an order, paid to its supplier today unless told otherwise. */
  async pay(orderId: string, payment: Partial<CreatePaymentBody> & { amountCny: number; rateInr: number }) {
    const body: CreatePaymentBody = { orderId, kind: "Balance", payeeRole: "supplier", agentId: null, paidOn: today(), mode: "Bank transfer", ...payment };
    return json<{ payment: { id: string } }>(await this.post("/payments", body), 201);
  }

  /** The REC-3 body for `quantities` per item name (missing items: 0). */
  async receiptBody(po: string, quantities: Record<string, number>, extra: { shortRemark?: string; bundles?: number; receivedOn?: string; deliveryNote?: string } = {}) {
    const [order, options] = await Promise.all([this.order(po), this.get<ReceiptOptions>("/receipts/options")]);
    return {
      orderId: order.id,
      receivedOn: extra.receivedOn ?? today(),
      locationId: options.offices[0]!.id,
      bundles: extra.bundles ?? 1,
      deliveryNote: extra.deliveryNote ?? "",
      shortRemark: extra.shortRemark ?? "",
      lines: order.lines.map((line) => ({ orderLineId: line.id, quantity: quantities[line.item.name] ?? 0 })),
    };
  }

  /** REC-3: a receipt of `quantities` per item name. */
  async receive(po: string, quantities: Record<string, number>, extra: Parameters<Api["receiptBody"]>[2] = {}) {
    const body = await this.receiptBody(po, quantities, { shortRemark: "Rest to follow", ...extra });
    return json<{ receipt: { id: string } }>(await this.post("/receipts", body), 201);
  }

  /** The CON-3 body: `lines` per PO and item name. */
  async containerBody(
    lines: { po: string; item: string; quantity: number; bundles?: number }[],
    extra: { number?: string; agent?: string; terms?: "FOB" | "CNF"; loadedOn?: string; sailedOn?: string | null; eta?: string } = {},
  ) {
    const options = await this.options();
    const agent = options.agents.find((a) => a.name === (extra.agent ?? "Sino Freight"))!;
    const orders = new Map<string, OrderDetail>();
    for (const { po } of lines) if (!orders.has(po)) orders.set(po, await this.order(po));
    const loadedOn = extra.loadedOn ?? today();
    return {
      number: extra.number ?? containerNumber(),
      shippingAgentId: agent.id,
      terms: extra.terms ?? "FOB",
      portOfLoading: "Guangzhou (Nansha)",
      portOfArrival: "Kochi",
      loadedOn,
      sailedOn: extra.sailedOn ?? null,
      eta: extra.eta ?? addDays(loadedOn, 20),
      lines: lines.map((line) => ({
        orderLineId: orders.get(line.po)!.lines.find((l) => l.item.name === line.item)!.id,
        bundles: line.bundles ?? 1,
        quantity: line.quantity,
      })),
    };
  }

  /** CON-3: a new container (status loading). */
  async load(lines: Parameters<Api["containerBody"]>[0], extra: Parameters<Api["containerBody"]>[1] = {}) {
    const body = await this.containerBody(lines, extra);
    const { container } = await json<{ container: { id: string } }>(await this.post("/containers", body), 201);
    return { id: container.id, number: body.number };
  }

  /** CON-5. */
  async updateContainer(id: string, body: { status?: Exclude<ContainerState, "loading">; sailedOn?: string; eta?: string }) {
    return json<{ container: { id: string; status: ContainerState } }>(await this.patch(`/containers/${id}`, body), 200);
  }
}

/**
 * goto and reload wait until the network is quiet, so React has hydrated the page before the test types or clicks:
 * a value chosen before hydration is reset by it (seen on a slow full run), and a click does nothing.
 */
export function settled(page: Page) {
  const goto = page.goto.bind(page);
  const reload = page.reload.bind(page);
  page.goto = async (...args: Parameters<Page["goto"]>) => {
    const response = await goto(...args);
    await page.waitForLoadState("networkidle");
    return response;
  };
  page.reload = async (...args: Parameters<Page["reload"]>) => {
    const response = await reload(...args);
    await page.waitForLoadState("networkidle");
    return response;
  };
  return page;
}

export const ANITA = "anita@mrgarments.com";
type Playwright = PlaywrightWorkerArgs["playwright"];
type StorageState = Awaited<ReturnType<APIRequestContext["storageState"]>>;

/** A new session for `email` (AUTH-1 with E2E_PASSWORD), as a storage state. */
export async function signInState(playwright: Playwright, baseURL: string | undefined, email: string): Promise<StorageState> {
  // No cookies: a request context otherwise starts from the project's Management session, and signing in replaces
  // (destroys) the session it is sent with.
  const request = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] }, extraHTTPHeaders: { Origin: baseURL ?? "" } });
  const response = await request.post("/api/v1/auth/login", { data: { email, password: process.env.E2E_PASSWORD, keepSignedIn: true } });
  expect(response.status(), `sign in as ${email}`).toBe(200);
  const state = await request.storageState();
  await request.dispose();
  return state;
}

/**
 * `test.use({ storageState: freshSignIn(ANITA) })`: a session made for this test. batch1-a5-passwords changes Anita's
 * password during the run, which ends the session auth.setup.ts saved for her (ACCOUNTS_STATE).
 */
export const freshSignIn =
  (email: string) =>
  async ({ playwright, baseURL }: { playwright: Playwright; baseURL: string | undefined }, provide: (state: StorageState) => Promise<void>) =>
    provide(await signInState(playwright, baseURL, email));

/** `api`: the API signed in as Management, with the Origin header the same-site check needs. `page` is settled. */
export const test = base.extend<{ api: Api }>({
  page: async ({ page }, provide) => provide(settled(page)),
  api: async ({ playwright, baseURL }, provide) => {
    const request = await playwright.request.newContext({ baseURL, storageState: MANAGEMENT_STATE, extraHTTPHeaders: { Origin: baseURL ?? "" } });
    await provide(new Api(request));
    await request.dispose();
  },
});

export { expect };
