import type { Metadata } from "next";

import { filterLabel } from "@/features/reports/data/filters";
import { getSupplierInsights } from "@/features/suppliers/data/queries";
import { InsightFilters, SupplierPerformance } from "@/features/suppliers/supplier-performance";
import { SuppliersFrame } from "@/features/suppliers/suppliers-frame";

export const metadata: Metadata = { title: "Supplier performance" };

/** Suppliers › Supplier Performance, for the URL's ?period= and ?supplier= (backend docs/suppliers.md SUP-2). */
export default async function SupplierPerformancePage({ searchParams }: PageProps<"/suppliers/performance">) {
  const data = await getSupplierInsights(await searchParams);
  return (
    <SuppliersFrame
      summary={data.summary}
      today={data.today}
      filter={filterLabel({ from: data.data.filter.from, supplier: data.data.filter.supplier })}
      actions={<InsightFilters periods={data.periods} suppliers={data.suppliers} />}
    >
      <SupplierPerformance data={data} />
    </SuppliersFrame>
  );
}
