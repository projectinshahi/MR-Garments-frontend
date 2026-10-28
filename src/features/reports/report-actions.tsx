"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { FilterSelect } from "@/components/shared/filters";
import { notInPrototype } from "@/components/shared/prototype";
import { Button } from "@/components/ui/button";
import { hrefWith, optionParam } from "@/features/calendar/params";

import { type CsvFile, downloadCsv } from "./csv";

/** A button from the reference whose action has no design (D5): Excel and PDF exports (no library is installed). */
export function PrototypeButton({ action, ...props }: React.ComponentProps<typeof Button> & { action: string }) {
  return <Button type="button" onClick={() => notInPrototype(action)} {...props} />;
}

/** Header actions on every report (33–38): CSV of the report's data, then the reference's Excel and PDF buttons. */
export function ExportActions({ csv }: { csv: CsvFile }) {
  return (
    <>
      <Button type="button" variant="outline" onClick={() => downloadCsv(csv)}>
        Export CSV
      </Button>
      <PrototypeButton action="Export Excel" variant="outline">
        Export Excel
      </PrototypeButton>
      <PrototypeButton action="Export PDF" variant="outline">
        Export PDF
      </PrototypeButton>
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
