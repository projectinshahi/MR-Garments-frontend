import { notFound } from "next/navigation";

import { canOpen, hasAccess } from "@/config/navigation";
import type { AdvanceArchiveResponse, DepositsResponse, SupplierStatement } from "@/lib/api/deposits-types";
import { ApiError } from "@/lib/api/errors";
import type { LedgerOverviewResponse, SupplierLedgerResponse } from "@/lib/api/ledger-types";
import { apiGet } from "@/lib/api/server";
import { getMe } from "@/lib/session";
import { todayInIndia } from "@/lib/today";

// Supplier ledger pages (backend docs/unified-ledger.md): LED-2 overview, LED-1 one supplier (with the read-only ADV-1
// and SD-1 archives), and DEP-1's Deposit Required milestones. The calls read the session cookie, so the pages render
// inside the shell's Suspense boundary; a failed call throws to error.tsx (an archive failure only hides that tab).

/** payments Enter: Record payment; Full: Void and Management adjustments; ordersView: POs open the order. */
async function getAccess() {
  const me = await getMe();
  return {
    canEnter: !!me && hasAccess(me, "payments", "Enter"),
    canFull: !!me && hasAccess(me, "payments", "Full"),
    linkPo: !!me && canOpen(me, "/orders"),
  };
}

export type LedgerOverviewData = Awaited<ReturnType<typeof getLedgerOverview>>;

/** LED-2 GET /api/v1/supplier-ledger. */
export async function getLedgerOverview() {
  const [overview, access] = await Promise.all([apiGet<LedgerOverviewResponse>("/supplier-ledger"), getAccess()]);
  return { overview, today: todayInIndia(), ...access };
}

export type SupplierLedgerData = Awaited<ReturnType<typeof getSupplierLedger>>;

/** LED-1 plus the archives (null when one can't be read); an unknown supplier renders the not-found page. */
export async function getSupplierLedger(supplierId: string) {
  const id = encodeURIComponent(supplierId);
  const archive = <T,>(path: string) => apiGet<T>(path).catch((): null => null);
  let ledger: SupplierLedgerResponse;
  let advances: AdvanceArchiveResponse | null;
  let deposits: SupplierStatement | null;
  try {
    [ledger, advances, deposits] = await Promise.all([
      apiGet<SupplierLedgerResponse>(`/suppliers/${id}/ledger`),
      archive<AdvanceArchiveResponse>(`/suppliers/${id}/advances`),
      archive<SupplierStatement>(`/suppliers/${id}/deposits`),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  return { ledger, advances, deposits, today: todayInIndia(), ...(await getAccess()) };
}

export type MilestonesData = Awaited<ReturnType<typeof getMilestones>>;

/** DEP-1 GET /api/v1/deposits: the orders with a Deposit Required and their milestone (the archives are not shown here). */
export async function getMilestones() {
  const [response, access] = await Promise.all([apiGet<DepositsResponse>("/deposits"), getAccess()]);
  return { milestones: response.milestones ?? [], suppliers: response.suppliers, today: todayInIndia(), linkPo: access.linkPo };
}
