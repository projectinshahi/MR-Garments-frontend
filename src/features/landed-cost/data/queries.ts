import { type SearchParams, toParams } from "@/features/calendar/params";
import { idQuery, isId } from "@/features/reports/data/filters";
import type { LandedCostResponse } from "@/lib/api/reports-types";
import { apiGet } from "@/lib/api/server";

// Landed Cost (31) reads GET /landed-cost, filtered by the page URL's ?supplier=<id> and ?team=<id>. The call reads
// the session cookie, so the page renders inside the (app) loading.tsx Suspense boundary; failures throw to error.tsx.

export type LandedCostData = Awaited<ReturnType<typeof getLandedCost>>;
export type { LandedCostRow } from "@/lib/api/reports-types";

/** Also returns the team the API filtered by (the same ?team= rule), so "By team" shows only that team's stock. */
export async function getLandedCost(search: SearchParams) {
  const params = toParams(search);
  const team = params.get("team");
  const data = await apiGet<LandedCostResponse>(`/landed-cost${idQuery(params, { supplier: "supplierId", team: "teamId" })}`);
  return { ...data, teamId: isId(team) ? team : null };
}
