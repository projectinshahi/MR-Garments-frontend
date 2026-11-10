import type { Metadata } from "next";

import { filterLabel } from "@/features/reports/data/filters";
import { getSupplierInsights } from "@/features/suppliers/data/queries";
import { SupplierAnalytics } from "@/features/suppliers/supplier-analytics";
import { InsightFilters } from "@/features/suppliers/supplier-performance";
import { SuppliersFrame } from "@/features/suppliers/suppliers-frame";

export const metadata: Metadata = { title: "Supplier analytics" };

/** Suppliers › Supplier Analytics, for the URL's ?period= and ?supplier= (backend docs/suppliers.md SUP-2). */
export default async function SupplierAnalyticsPage({ searchParams }: PageProps<"/suppliers/analytics">) {
  const data = await getSupplierInsights(await searchParams);
  return (
    <SuppliersFrame
      summary={data.summary}
      today={data.today}
      filter={filterLabel({ from: data.data.filter.from, supplier: data.data.filter.supplier })}
      actions={<InsightFilters periods={data.periods} suppliers={data.suppliers} />}
    >
      <SupplierAnalytics data={data} />
    </SuppliersFrame>
  );
}
