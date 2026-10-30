"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useTransition } from "react";

import { FilterSelect } from "@/components/shared/filters";
import { Button } from "@/components/ui/button";
import { hrefWith, optionParam } from "@/features/calendar/params";
import { apiClient } from "@/lib/api/client";
import { handleApiError } from "@/lib/feedback";
import { todayInIndia } from "@/lib/today";

import { reportQuery } from "./data/filters";
import { downloadReport, type FileFormat, type ReportFile, type ReportName, type ReportResponse, reportFile } from "./report-files";

/** Runs one download at a time; a failure (session ended included) is handled as every API call is (E1-E14). */
function useDownload(make: () => Promise<ReportFile>) {
  const [pending, startTransition] = useTransition();
  const download = (format: FileFormat) =>
    startTransition(async () => {
      try {
        await downloadReport(await make(), format);
      } catch (error) {
        handleApiError(error);
      }
    });
  return { pending, download };
}

/** Header actions on every report (33–38): the report's tables, as the page shows them, as CSV, Excel or PDF. */
export function ExportActions({ file }: { file: ReportFile }) {
  const { pending, download } = useDownload(async () => file);
  return (
    <>
      <Button type="button" variant="outline" disabled={pending} onClick={() => download("csv")}>
        Export CSV
      </Button>
      <Button type="button" variant="outline" disabled={pending} onClick={() => download("xlsx")}>
        Export Excel
      </Button>
      <Button type="button" variant="outline" disabled={pending} onClick={() => download("pdf")}>
        Export PDF
      </Button>
    </>
  );
}

/**
 * A hub card's Excel and PDF buttons (32): the report with the hub's filters, as its Open report link shows it. The hub
 * has no report data, so the click loads GET /reports/<name> (the call the report page makes).
 */
export function CardDownloads({ name, title, query, className }: { name: ReportName; title: string; query: string; className: string }) {
  const { pending, download } = useDownload(async () =>
    reportFile(name, await apiClient.get<ReportResponse>(`/reports/${name}${reportQuery(new URLSearchParams(query))}`), todayInIndia()),
  );
  return (
    <>
      <Button type="button" variant="outline" size="sm" className={className} disabled={pending} aria-label={`Excel export: ${title}`} onClick={() => download("xlsx")}>
        Excel
      </Button>
      <Button type="button" variant="outline" size="sm" className={className} disabled={pending} aria-label={`PDF export: ${title}`} onClick={() => download("pdf")}>
        PDF
      </Button>
    </>
  );
}

type UrlSelectProps = Omit<React.ComponentProps<typeof FilterSelect>, "value" | "onValueChange"> & { param: string };

/**
 * A filter dropdown kept in the URL (`?<param>=`, "all" removes it; the other parameters stay), so the server page
 * reloads its data with the filter. Calendar's ParamSelect, with every FilterSelect option (the hub's inline label).
 */
export function UrlSelect({ param, ...select }: UrlSelectProps) {
  return (
    <Suspense fallback={<FilterSelect {...select} value="all" onValueChange={() => {}} />}>
      <BoundSelect param={param} {...select} />
    </Suspense>
  );
}

function BoundSelect({ param, ...select }: UrlSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <FilterSelect
      {...select}
      value={optionParam(params, param, select.options)}
      onValueChange={(value) => router.push(hrefWith(pathname, params, param, value === "all" ? null : value))}
    />
  );
}
