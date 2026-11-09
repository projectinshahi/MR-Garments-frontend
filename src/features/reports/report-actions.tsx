"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useTransition } from "react";

import { useNavigate } from "@/components/layout/navigation-progress";
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

const FORMAT_LABEL: Record<FileFormat, string> = { csv: "Export CSV", xlsx: "Export Excel", pdf: "Export PDF" };
const ALL_FORMATS: FileFormat[] = ["csv", "xlsx", "pdf"];

/**
 * Header actions on every report (33–38): the report's tables, as the page shows them, as CSV, Excel or PDF. `file`
 * may be a function, built only when a button is clicked (a list's current filtered rows). `formats` narrows the
 * buttons (the orders, deposits and order-report pages offer Excel and PDF); `size` matches the page header's buttons.
 */
export function ExportActions({
  file,
  formats = ALL_FORMATS,
  size,
}: {
  file: ReportFile | (() => ReportFile | Promise<ReportFile>);
  formats?: FileFormat[];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const { pending, download } = useDownload(async () => (typeof file === "function" ? file() : file));
  return (
    <>
      {formats.map((format) => (
        // "Excel" / "PDF" on a phone, so three header buttons fit beside the title; the accessible name stays the full label.
        <Button key={format} type="button" variant="outline" size={size} disabled={pending} aria-label={FORMAT_LABEL[format]} onClick={() => download(format)}>
          <span className="max-sm:hidden">Export </span>
          {FORMAT_LABEL[format].replace("Export ", "")}
        </Button>
      ))}
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
 * reloads its data with the filter; the old choice shows until the new page is loaded, so the progress bar follows the
 * navigation. Calendar's ParamSelect, with every FilterSelect option (the hub's inline label).
 */
export function UrlSelect({ param, ...select }: UrlSelectProps) {
  return (
    <Suspense fallback={<FilterSelect {...select} value="all" onValueChange={() => {}} />}>
      <BoundSelect param={param} {...select} />
    </Suspense>
  );
}

function BoundSelect({ param, ...select }: UrlSelectProps) {
  const navigate = useNavigate();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <FilterSelect
      {...select}
      value={optionParam(params, param, select.options)}
      onValueChange={(value) => navigate(hrefWith(pathname, params, param, value === "all" ? null : value))}
    />
  );
}
