import { ApiError } from "@/lib/api/errors";
import type { OrderReport } from "@/lib/api/reports-types";
import { apiGet } from "@/lib/api/server";
import { decodePath } from "@/lib/utils";

// The order's Report tab reads RPT-O1. The call reads the session cookie, so the page renders inside the order
// layout's Suspense; failures other than 404 throw to error.tsx.

/** One order's report, or null when the PO doesn't exist (RPT-O1 404). The [po] segment arrives percent-encoded. */
export async function getOrderReport(po: string): Promise<OrderReport | null> {
  try {
    return await apiGet<OrderReport>(`/orders/${encodeURIComponent(decodePath(po))}/report`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
