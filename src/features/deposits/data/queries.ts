import { notFound } from "next/navigation";

import { canOpen, hasAccess } from "@/config/navigation";
import type { DepositsResponse, SupplierAdvanceResponse, SupplierStatement } from "@/lib/api/deposits-types";
import { ApiError } from "@/lib/api/errors";
import { apiGet } from "@/lib/api/server";
import { getMe } from "@/lib/session";
import { todayInIndia } from "@/lib/today";

import { toRows } from "../deposits-logic";

// Deposits pages read DEP-1 once and filter on the client (as Orders does); the statement reads SD-1. The calls read
// the session cookie, so the pages render inside the shell's Suspense boundary; a failed call throws to error.tsx.

/** What the signed-in user may do: open and settle deposits (payments Enter), delete (Full), open orders from a PO. */
async function getAccess() {
  const me = await getMe();
  return {
    canEnter: !!me && hasAccess(me, "payments", "Enter"),
    canDelete: !!me && hasAccess(me, "payments", "Full"),
    linkPo: !!me && canOpen(me, "/orders"),
  };
}

export type DepositsData = Awaited<ReturnType<typeof getDeposits>>;

/** DEP-1 GET /api/v1/deposits as table rows, the suppliers to filter by, and today in India (read after the API call). */
export async function getDeposits() {
  const [response, access] = await Promise.all([apiGet<DepositsResponse>("/deposits"), getAccess()]);
  // Order rows link to their order only when the user may open orders (as PoLink does).
  return { rows: toRows(response, access.linkPo), suppliers: response.suppliers, advances: response.advances ?? [], today: todayInIndia(), ...access };
}

export type AdvanceOverviewData = Awaited<ReturnType<typeof getAdvanceOverview>>;

/**
 * Deposits › Supplier advance, supplier-wise: DEP-1's suppliers (active ones, and any inactive one with records) and
 * each one's advance account per currency (`advances`, the ledger's totals). Nothing else is added in.
 */
export async function getAdvanceOverview() {
  const deposits = await getDeposits();
  return { suppliers: deposits.suppliers, advances: deposits.advances, today: deposits.today, canEnter: deposits.canEnter };
}

export type AdvanceSupplierData = Awaited<ReturnType<typeof getAdvanceSupplier>>;

/**
 * One supplier's advance page: ADV-1 (the ledger: totals per currency, every entry with its balance, the orders still
 * owing) and SD-1's supplier details (contact, phone, city). An unknown supplier renders the not-found page.
 */
export async function getAdvanceSupplier(supplierId: string) {
  let account: SupplierAdvanceResponse;
  let details: SupplierStatement["supplier"];
  try {
    [account, { supplier: details }] = await Promise.all([
      apiGet<SupplierAdvanceResponse>(`/suppliers/${encodeURIComponent(supplierId)}/advances`),
      apiGet<SupplierStatement>(`/suppliers/${encodeURIComponent(supplierId)}/deposits`),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  return { account, details, today: todayInIndia(), ...(await getAccess()) };
}

export type StatementData = Awaited<ReturnType<typeof getStatement>>;

/** SD-1 GET /api/v1/suppliers/:supplierId/deposits; an unknown supplier renders the not-found page. */
export async function getStatement(supplierId: string) {
  let statement: SupplierStatement;
  try {
    statement = await apiGet<SupplierStatement>(`/suppliers/${encodeURIComponent(supplierId)}/deposits`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  return { statement, today: todayInIndia(), ...(await getAccess()) };
}
