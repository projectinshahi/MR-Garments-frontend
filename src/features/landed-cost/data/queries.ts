import { type SearchParams, toParams } from "@/features/calendar/params";
import { idQuery } from "@/features/reports/data/filters";
import type { LandedCostResponse } from "@/lib/api/reports-types";
import { apiGet } from "@/lib/api/server";

// Landed Cost (31) reads GET /landed-cost, filtered by the page URL's ?supplier=<id> and ?team=<id>. The call reads
// the session cookie, so the page renders inside the (app) loading.tsx Suspense boundary; failures throw to error.tsx.

export type LandedCostData = LandedCostResponse;
export type { LandedCostRow } from "@/lib/api/reports-types";

export const getLandedCost = (search: SearchParams) =>
  apiGet<LandedCostResponse>(`/landed-cost${idQuery(toParams(search), { supplier: "supplierId", team: "teamId" })}`);
