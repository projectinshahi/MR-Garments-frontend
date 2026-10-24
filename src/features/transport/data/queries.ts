import { listTransportCompanies } from "@/lib/data/master";

import { containerSlug } from "../transport-logic";
import * as fixtures from "./fixtures";

export type { TransportForm, TransportRow, TransportState } from "./fixtures";

export type TransportListData = Awaited<ReturnType<typeof getTransportList>>;
export type TransportListRow = TransportListData["rows"][number];
export type TransportFormData = NonNullable<Awaited<ReturnType<typeof getTransportForm>>>;

const formSlugs = () => fixtures.transportForms.map((form) => containerSlug(form.container));

/**
 * Transport list: vehicles (with a link where a form is designed), the company filter options, and the target of
 * "+ Record transport" (the only designed form).
 */
export async function getTransportList() {
  const companies = await listTransportCompanies();
  const slugs = formSlugs();
  return structuredClone({
    rows: fixtures.transports.map((row) => {
      const slug = containerSlug(row.container);
      return { ...row, formHref: slugs.includes(slug) ? `/transport/${slug}` : undefined };
    }),
    companies: companies.map((c) => c.name),
    recordHref: `/transport/${slugs[0]}`,
  });
}

/** Route parameters for the designed transport forms ("CAIU-2298076"). */
export async function listTransportFormSlugs() {
  return formSlugs();
}

/** Transport form for one container, by its route slug; undefined for an unknown container. */
export async function getTransportForm(slug: string) {
  const form = fixtures.transportForms.find((f) => containerSlug(f.container) === slug);
  if (!form) return undefined;
  const companies = await listTransportCompanies();
  return structuredClone({ ...form, companies: companies.map((c) => c.name) });
}
