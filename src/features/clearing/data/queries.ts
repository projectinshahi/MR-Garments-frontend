import { listClearingAgents } from "@/lib/data/master";

import * as fixtures from "./fixtures";

export type { ClearingForm, ClearingRow, ClearingState } from "./fixtures";

export type ClearingListData = Awaited<ReturnType<typeof getClearingList>>;
export type ClearingFormData = NonNullable<Awaited<ReturnType<typeof getClearingForm>>>;

/** Route segment for a container: "CAIU 2298076" → "CAIU-2298076". */
export const containerSlug = (container: string) => container.replace(/ /g, "-");

const agentNames = async () => (await listClearingAgents()).map((agent) => agent.name);

/** Clearing (India) list: KPIs, containers and the agent filter options. Async and copied so a real API can replace it. */
export async function getClearingList() {
  const agents = await agentNames();
  return structuredClone({ kpis: fixtures.clearingKpis, rows: fixtures.clearings, agents });
}

/** Containers that have a designed clearing form (only CAIU 2298076). */
export async function listClearingFormSlugs() {
  return fixtures.clearingForms.map((form) => containerSlug(form.container));
}

/** Clearing form for one container, or null when it is unknown. */
export async function getClearingForm(slug: string) {
  const form = fixtures.clearingForms.find((f) => containerSlug(f.container) === slug);
  if (!form) return null;
  const agents = await agentNames();
  return structuredClone({ ...form, agents });
}
