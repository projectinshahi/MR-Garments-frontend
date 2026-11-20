"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { RouteTabs } from "@/components/layout/route-tabs";
import { CardNote, SectionCard } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { FilterSelect, SearchInput, type FilterOption } from "@/components/shared/filters";
import { PoLink } from "@/components/shared/po-link";
import { StatusPill } from "@/components/shared/status-pill";
import { DASH, MILESTONE_STATUS, MilestonePill, moneyOrDash } from "@/features/payments/money";
import { ReportDownload } from "@/features/reports/report-actions";
import { describeFilters } from "@/features/reports/report-files";
import type { DepositMilestone } from "@/lib/api/deposits-types";
import { formatDate, formatMoney } from "@/lib/formatters";

import type { MilestonesData } from "./data/queries";
import { ledgerHref } from "./ledger-logic";
import { milestonesFile } from "./ledger-files";
import { LEDGER_TABS } from "./ledger-overview-screen";

// Deposit Required milestones (D11, DEP-1 `milestones`): what each supplier asked for as a deposit, how much the
// supplier account has settled of the order, and whether the milestone is met. Never a balance; held orders have no figures.

const ALL = "all";
const STATUS_OPTIONS: FilterOption[] = [
  { value: ALL, label: "All milestones" },
  { value: "unmet", label: MILESTONE_STATUS.unmet.label },
  { value: "partly", label: MILESTONE_STATUS.partly.label },
  { value: "met", label: MILESTONE_STATUS.met.label },
  { value: "held", label: "Pending review" },
];

export function filterMilestones(rows: DepositMilestone[], query: string, status: string) {
  const q = query.trim().toLowerCase();
  return rows.filter(
    (m) =>
      (!q || m.po.toLowerCase().includes(q) || m.supplier.toLowerCase().includes(q)) &&
      (status === ALL || (status === "held" ? m.held : !m.held && m.depositStatus === status)),
  );
}

const columns = (linkPo: boolean): ColumnDef<DepositMilestone>[] => {
  const money = (value: number | null, m: DepositMilestone) => moneyOrDash(value, (v) => formatMoney(v, m.currency, { decimals: 2 }));
  return [
    { accessorKey: "po", header: "PO", cell: ({ row }) => <PoLink po={row.original.po} linked={linkPo} /> },
    { accessorKey: "orderDate", header: "Order date", cell: ({ row }) => formatDate(row.original.orderDate) },
    {
      accessorKey: "supplier",
      header: "Supplier",
      cell: ({ row }) => (
        <Link href={ledgerHref(row.original.supplierId)} className="text-primary hover:underline">
          {row.original.supplier}
        </Link>
      ),
    },
    { accessorKey: "depositRequiredCny", header: "Deposit required", meta: { align: "right" }, cell: ({ row }) => money(row.original.depositRequiredCny, row.original) },
    { accessorKey: "depositSettledCny", header: "Settled", meta: { align: "right" }, cell: ({ row }) => money(row.original.depositSettledCny, row.original) },
    { accessorKey: "depositPendingCny", header: "Pending", meta: { align: "right" }, cell: ({ row }) => money(row.original.depositPendingCny, row.original) },
    {
      id: "status",
      header: "Milestone",
      cell: ({ row }) =>
        row.original.held ? <StatusPill tone="neutral">Pending review</StatusPill> : row.original.depositStatus ? <MilestonePill status={row.original.depositStatus} /> : DASH,
    },
  ];
};

export function MilestonesScreen({ data }: { data: MilestonesData }) {
  const { milestones, today, linkPo } = data;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(ALL);
  const shown = filterMilestones(milestones, query, status);
  const label = describeFilters([query.trim() && `Search: "${query.trim()}"`, status !== ALL && `Milestone: ${STATUS_OPTIONS.find((o) => o.value === status)?.label}`]);

  return (
    <>
      <PageHeader title="Supplier ledger" actions={<ReportDownload file={() => milestonesFile(shown, label, today)} />} />
      <RouteTabs tabs={LEDGER_TABS} label="Supplier ledger views" />
      <PageContainer>
        <SectionCard title="Deposit milestones" aside={<CardNote size="sm">A milestone of the order, never a balance</CardNote>} titleGap="none">
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <SearchInput label="Search PO or supplier" placeholder="Search PO or supplier" value={query} onValueChange={setQuery} className="w-full sm:w-auto sm:max-w-[290px] sm:flex-[1_1_200px]" />
            <FilterSelect label="Milestone" showLabel size="sm" value={status} options={STATUS_OPTIONS} onValueChange={setStatus} />
          </div>
          <DataTable
            key={`${query}|${status}`}
            columns={columns(linkPo)}
            data={shown}
            getRowId={(m) => m.orderId}
            size="sm"
            header="tall"
            emptyState={milestones.length ? "No milestones match these filters." : "No order has a deposit required."}
            pagination={{ pageSize: 15, itemLabel: "orders" }}
            className="mt-3"
          />
        </SectionCard>
      </PageContainer>
    </>
  );
}
