import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { RouteTabs, type RouteTab } from "@/components/layout/route-tabs";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { balanceText, HELD_BALANCE } from "@/features/payments/money";
import type { SupplierHistoryHeader } from "@/lib/api/supplier-history-types";

import { HistorySkeleton } from "./history-skeleton";
import { getHistoryHeader } from "./queries";

// The supplier profile (Supplier 360°, backend docs/supplier-history.md): one header and tab bar over Overview, Orders,
// Payments, Receiving, Landed cost, Activity and Legacy archive. The history tabs share this frame through their layout,
// so moving between them keeps the header and loads only the tab.

const TABS: { segment: string; label: string }[] = [
  { segment: "", label: "Overview" },
  { segment: "/orders", label: "Orders" },
  { segment: "/payments", label: "Payments" },
  { segment: "/receiving", label: "Receiving" },
  { segment: "/landed-cost", label: "Landed cost" },
  { segment: "/activity", label: "Activity" },
  { segment: "/archive", label: "Legacy archive" },
];
export const supplierHref = (id: string, segment = "") => `/suppliers/${encodeURIComponent(id)}${segment}`;
/** The list's edit dialog (settings-dialog.tsx `editHref`, a client module, so spelt out here on the server). */
const editHref = (id: string) => `/suppliers?dialog=edit&id=${encodeURIComponent(id)}`;

export function SupplierTabs({ id }: { id: string }) {
  const tabs: RouteTab[] = TABS.map((tab) => ({ href: supplierHref(id, tab.segment), label: tab.label }));
  return <RouteTabs tabs={tabs} label="Supplier sections" />;
}

export function EditSupplierButton({ id }: { id: string }) {
  return (
    <Button asChild variant="outline" size="header">
      <Link href={editHref(id)}>Edit supplier</Link>
    </Button>
  );
}

/** The live accounts (the ledger now), apart from every historical total below them. */
export function LiveBalances({ overview }: { overview: Pick<SupplierHistoryHeader, "accounts" | "holds"> }) {
  if (overview.accounts.length === 0) return null;
  return (
    <section aria-label="Current balance (live)" className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border bg-card px-5 py-3 text-[14px]">
      <span className="text-[12px] font-bold tracking-[0.06em] text-muted-foreground uppercase">Current balance (live)</span>
      {overview.accounts.map((account) => (
        <span key={account.currency} className="font-bold text-label">
          {account.currency}: {account.held || account.balanceCny === null ? HELD_BALANCE : balanceText(account.balanceCny, account.currency)}
        </span>
      ))}
    </section>
  );
}

/** Header, live balances and tabs for the history tabs; the tab's content streams in under them. */
export async function SupplierHistoryFrame({ params, children }: { params: Promise<{ id: string }>; children: React.ReactNode }) {
  const { id } = await params;
  const overview = await getHistoryHeader(id);
  const { supplier, holds } = overview;
  return (
    <>
      <PageHeader
        title={supplier.name}
        parent={{ label: "Suppliers", href: "/suppliers" }}
        titleAddon={
          <span className="flex items-center gap-2">
            {supplier.code ? <StatusPill tone="neutral">{supplier.code}</StatusPill> : null}
            {holds.length ? <StatusPill tone="warning">On hold (pending review)</StatusPill> : null}
          </span>
        }
        actions={<EditSupplierButton id={supplier.id} />}
      />
      <SupplierTabs id={supplier.id} />
      <div className="px-4 pt-(--page-padding-top) md:px-(--page-padding)">
        <LiveBalances overview={overview} />
      </div>
      <Suspense fallback={<HistorySkeleton />}>{children}</Suspense>
    </>
  );
}
