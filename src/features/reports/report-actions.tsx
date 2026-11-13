"use client";

import { ChevronDown, Download, FileSpreadsheet, FileText, Sheet } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { useNavigate } from "@/components/layout/navigation-progress";
import { FilterSelect } from "@/components/shared/filters";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { hrefWith, optionParam } from "@/features/calendar/params";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { handleApiError, MESSAGES } from "@/lib/feedback";
import { todayInIndia } from "@/lib/today";
import { cn } from "@/lib/utils";

import { reportQuery } from "./data/filters";
import { downloadReport, type FileFormat, type ReportFile, type ReportName, type ReportResponse, reportFile } from "./report-files";

/** A failed request is handled as every API call is (E1-E14); a file that could not be written says so. */
function downloadFailed(error: unknown) {
  if (error instanceof ApiError) handleApiError(error);
  else toast.error("The report could not be created.", { description: MESSAGES.tryAgain });
}

/** Runs one download at a time (hub cards). */
function useDownload(make: () => Promise<ReportFile>) {
  const [pending, startTransition] = useTransition();
  const download = (format: FileFormat) =>
    startTransition(async () => {
      try {
        await downloadReport(await make(), format);
      } catch (error) {
        downloadFailed(error);
      }
    });
  return { pending, download };
}

const FORMATS: { format: FileFormat; label: string; Icon: typeof FileText }[] = [
  { format: "pdf", label: "Download PDF", Icon: FileText },
  { format: "xlsx", label: "Download Excel (.xlsx)", Icon: FileSpreadsheet },
  { format: "csv", label: "Download CSV (.csv)", Icon: Sheet },
];

/**
 * The page's "Download report" menu: PDF, Excel or CSV of the page's own report (each page's file builder decides
 * what it holds: every record matching the page's filters, never only the visible page of the table). `file` may be a
 * function, run only when a format is chosen (it may load more data). One download runs at a time: the button shows
 * "Preparing…" and is disabled until the file is saved; a failure is toasted. On a phone only the icon shows (the
 * accessible name stays "Download report").
 */
export function ReportDownload({
  file,
  size = "header",
  label = "Download report",
  className,
}: {
  file: ReportFile | (() => ReportFile | Promise<ReportFile>);
  size?: React.ComponentProps<typeof Button>["size"];
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  // A second choice before React re-renders the disabled button still finds the guard set.
  const running = useRef(false);
  const download = async (format: FileFormat) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await downloadReport(typeof file === "function" ? await file() : file, format);
    } catch (error) {
      downloadFailed(error);
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size={size} disabled={busy} aria-label={busy ? "Preparing report" : label} className={cn("max-sm:px-2.5", className)}>
          {busy ? <Spinner aria-hidden role="presentation" /> : <Download aria-hidden className="size-4" />}
          <span className="max-sm:sr-only">{busy ? "Preparing…" : label}</span>
          <ChevronDown aria-hidden className="size-3.5 opacity-70 max-sm:hidden" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-56">
        {FORMATS.map(({ format, label: item, Icon }) => (
          <DropdownMenuItem key={format} onSelect={() => void download(format)} className="gap-2 py-2">
            <Icon aria-hidden className="text-muted-foreground" />
            {item}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
