import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import { StatusPill } from "@/components/shared/status-pill";
import { Footnote } from "@/features/reports/report-screens";
import { DetailUrlProvider } from "@/features/reports/supplier-detail-tables";
import { formatNumber } from "@/lib/formatters";

import { HistoryDownload } from "./history-download";
import { HistoryFilters } from "./history-filters";
import { EVENT_LABEL, HISTORY_NOTE, historyFilterLabel, historyQuery, STATUS_OPTIONS, TYPE_OPTIONS } from "./history-logic";
import { HistoryEventsList } from "./history-tables";
import type { SupplierHistoryReportPage } from "./queries";

// Supplier History report (RPT-SH, backend docs/supplier-history.md): every recorded event of one supplier or of all,
// filtered by supplier, dates, event type, status and text, 25 a page; the download holds every matching event.

export function SupplierHistoryReportScreen({ page, linkPos }: { page: SupplierHistoryReportPage; linkPos: boolean }) {
  const { data, search, today } = page;
  const label = historyFilterLabel(data.filter);
  const params = new URLSearchParams(search);
  const top = Object.entries(data.byType)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
    .slice(0, 3)
    .map(([type, count]) => `${EVENT_LABEL[type as keyof typeof EVENT_LABEL]} ${count}`)
    .join(" · ");
  return (
    <DetailUrlProvider base="/reports/supplier-history" search={search}>
      <PageHeader
        title="Supplier history"
        parent={{ label: "Reports", href: "/reports" }}
        titleAddon={label ? <StatusPill tone="neutral">{label}</StatusPill> : undefined}
        actions={
          <HistoryDownload
            apiPath={`/reports/supplier-history${historyQuery(params, { statuses: ["active", "voided", "held", "migrated"], events: true, supplier: true })}`}
            title="Supplier history"
            filename={`supplier-history-${today}`}
            filters={label ?? "Every supplier, every event"}
            withSupplier
          />
        }
      />
      <PageContainer>
        <HistoryFilters
          searchLabel="Search"
          placeholder="PO, reference, container"
          selects={[
            { param: "supplier", label: "Supplier", options: [{ value: "all", label: "All suppliers" }, ...data.options.suppliers.map((s) => ({ value: s.id, label: s.name }))] },
            { param: "type", label: "Event type", options: TYPE_OPTIONS },
            { param: "status", label: "Status", options: STATUS_OPTIONS },
          ]}
        />
        <KpiRow gap="sm">
          <KpiCard size="xs" label="Events" value={formatNumber(data.events.total)} sub={label ? "matching the filters" : "every supplier"} />
          <KpiCard size="xs" label="Most frequent" value={top || "–"} sub="events by type, matching the filters" />
        </KpiRow>
        <SectionCard title="Events" titleGap="none" className="min-w-0">
          <HistoryEventsList list={data.events} linkPos={linkPos} withSupplier={!data.filter.supplier} />
        </SectionCard>
        <Footnote>{HISTORY_NOTE}</Footnote>
      </PageContainer>
    </DetailUrlProvider>
  );
}
