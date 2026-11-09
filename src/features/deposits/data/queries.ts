import { notFound } from "next/navigation";

import { canOpen, hasAccess } from "@/config/navigation";
import type { DepositsResponse, SupplierStatement } from "@/lib/api/deposits-types";
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
  return { rows: toRows(response), suppliers: response.suppliers, today: todayInIndia(), ...access };
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
