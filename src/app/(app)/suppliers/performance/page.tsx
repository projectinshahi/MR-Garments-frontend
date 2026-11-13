import type { Metadata } from "next";

import { filterLabel } from "@/features/reports/data/filters";
import { ReportDownload } from "@/features/reports/report-actions";
import { getSupplierInsights } from "@/features/suppliers/data/queries";
import { supplierInsightsFile } from "@/features/suppliers/insight-files";
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
      actions={
        <>
          <InsightFilters periods={data.periods} suppliers={data.suppliers} />
          <ReportDownload file={supplierInsightsFile(data, "performance")} />
        </>
      }
    >
      <SupplierPerformance data={data} />
    </SuppliersFrame>
  );
}
