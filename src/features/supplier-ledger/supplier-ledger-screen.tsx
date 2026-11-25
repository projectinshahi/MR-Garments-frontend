"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Callout, CardNote, KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { FilterSelect } from "@/components/shared/filters";
import { PoLink } from "@/components/shared/po-link";
import { EmptyState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { ADVANCE_KIND_LABEL } from "@/features/deposits/advance-logic";
import { stageLabel } from "@/features/orders/order-status";
import { BalanceFigure, balanceText, DASH, HELD_BALANCE, HELD_MESSAGE, MilestonePill, moneyOrDash, PaymentStatusPill } from "@/features/payments/money";
import { RecordPaymentDialog } from "@/features/payments/record-payment-dialog";
import { VoidPaymentButton } from "@/features/payments/void-payment";
import { ReportDownload } from "@/features/reports/report-actions";
import { describeFilters } from "@/features/reports/report-files";
import type { AdvanceArchiveEntry } from "@/lib/api/deposits-types";
import type { HeldAccount, LedgerAccount, LedgerEntry, LedgerEntryType, LedgerOrder } from "@/lib/api/ledger-types";
import { formatDate, formatDateTime, formatINR, formatMoney, formatRateInr } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import { AdjustmentDialog } from "./adjustment-dialog";
import type { SupplierLedgerData } from "./data/queries";
import { DepositsArchive } from "./deposits-archive";
import { statementFile } from "./ledger-files";
import {
  ENTRY_LABEL,
  entryLabel,
  entryTone,
  EXCLUDED_FROM_LEDGER,
  filterEntries,
  isZeroOrderEntry,
  NO_CHANGE,
  NOTHING_RECEIVED,
  paymentChoice,
  reasonOf,
  signed,
  type StatementFilters,
  ZERO_ORDER_PILL,
} from "./ledger-logic";

// One supplier's ledger (LED-1, D14): an account card per currency (signed), the statement newest first with the
// running balance, the orders' FIFO projection, held accounts' raw records, and the two read-only archives. Record
// payment (payments Enter), Void and Management adjustments (payments Full).

const ALL = "all";
const right = { align: "right" } as const;
const amountOf = (value: number, currency: string) => formatMoney(value, currency, { decimals: 2 });

const TABS = [
  { id: "statement", label: "Statement" },
  { id: "orders", label: "Orders" },
  { id: "advance", label: "Legacy advance history" },
  { id: "deposits", label: "Supplier deposits (archive)" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/** A payment row's facts for its Void (PAY-3). */
const voidable = (entry: LedgerEntry, supplier: string) => ({
  id: entry.paymentId!,
  po: entry.payment?.memoPo ?? null,
  supplier,
  currency: entry.currency,
  kind: entry.payment?.kind ?? "Payment",
  payee: supplier,
  payeeRole: "supplier" as const,
  amountCny: entry.amount,
  status: "paid" as const,
  paidOn: entry.entryDate,
  dueDate: null,
  rateInr: entry.exchangeRate,
  amountInr: entry.amountInr,
  mode: entry.payment?.mode ?? null,
  reference: entry.payment?.reference ?? "",
});

/** What the entry carries besides its amount: the payment's mode and reference, a legacy PO memo, a reason, before/after. */
function EntryDetails({ entry }: { entry: LedgerEntry }) {
  const reason = reasonOf(entry);
  const parts = [
    entry.payment?.mode,
    entry.payment?.reference,
    entry.payment?.memoPo ? `recorded against ${entry.payment.memoPo}` : null,
    entry.advance ? `legacy advance receipt${entry.advance.reference ? ` · ${entry.advance.reference}` : ""}` : null,
  ].filter(Boolean);
  return (
    <span className="flex flex-col gap-0.5">
      {parts.length ? <span>{parts.join(" · ")}</span> : null}
      {reason ? <span>Reason: {reason}</span> : null}
      {entry.entryType === "adjustment" && entry.balanceBefore !== null && entry.balanceAfter !== null ? (
        <span className="text-muted-foreground">
          {/* The account's balance at the moment the adjustment was recorded (it may be dated earlier: the Balance after column is by date). */}
          When recorded: {balanceText(entry.balanceBefore, entry.currency)} → {balanceText(entry.balanceAfter, entry.currency)}
        </span>
      ) : null}
      {entry.payment?.voided ? (
        <span className="text-danger">
          Voided{entry.payment.voidedBy ? ` by ${entry.payment.voidedBy}` : ""}
          {entry.payment.voidedAt ? `, ${formatDateTime(entry.payment.voidedAt)}` : ""}
        </span>
      ) : null}
      {!parts.length && !reason && !entry.payment?.voided ? DASH : null}
    </span>
  );
}

const statementColumns = (supplier: string, linkPo: boolean, canVoid: boolean, manyCurrencies: boolean): ColumnDef<LedgerEntry>[] => [
  { accessorKey: "entryDate", header: "Date", cell: ({ row }) => formatDate(row.original.entryDate) },
  {
    accessorKey: "entryType",
    header: "Type",
    cell: ({ row }) => (
      <span className="flex flex-col items-start gap-1">
        <StatusPill tone={entryTone(row.original)}>
          {isZeroOrderEntry(row.original) ? ZERO_ORDER_PILL[row.original.entryType as keyof typeof ZERO_ORDER_PILL] : entryLabel(row.original)}
        </StatusPill>
        {isZeroOrderEntry(row.original) ? <span className="text-xs text-muted-foreground">{NOTHING_RECEIVED}</span> : null}
        {row.original.payment?.voided ? <StatusPill tone="danger">Voided</StatusPill> : null}
        {row.original.origin === "backfill" ? <span className="text-xs text-muted-foreground">Migrated</span> : null}
      </span>
    ),
  },
  ...(manyCurrencies ? [{ accessorKey: "currency", header: "Currency" } satisfies ColumnDef<LedgerEntry>] : []),
  { accessorKey: "po", header: "PO", cell: ({ row }) => (row.original.po ? <PoLink po={row.original.po} linked={linkPo && row.original.orderId !== null} /> : DASH) },
  { id: "details", header: "Details", meta: { className: "min-w-[130px] max-w-[280px] whitespace-normal" }, cell: ({ row }) => <EntryDetails entry={row.original} /> },
  {
    accessorKey: "amount",
    header: "Amount",
    meta: right,
    cell: ({ row }) =>
      // A zero-value order posting moves no money: "No change", never a green "+¥0.00" that could read as a payment.
      isZeroOrderEntry(row.original) ? (
        <span className="whitespace-nowrap text-muted-foreground">{NO_CHANGE}</span>
      ) : (
        <span className={cn("font-bold whitespace-nowrap", row.original.amount < 0 ? "text-danger" : "text-success")}>{signed(row.original.amount, (v) => amountOf(v, row.original.currency))}</span>
      ),
  },
  { accessorKey: "exchangeRate", header: "Rate (INR)", meta: right, cell: ({ row }) => (row.original.currency === "INR" || row.original.exchangeRate === null ? DASH : formatRateInr(row.original.exchangeRate)) },
  { accessorKey: "amountInr", header: "INR", meta: right, cell: ({ row }) => moneyOrDash(row.original.amountInr === null ? null : Math.abs(row.original.amountInr), (v) => formatINR(v, 2)) },
  { accessorKey: "runningBalance", header: "Balance after", meta: right, cell: ({ row }) => <BalanceFigure balance={row.original.runningBalance} currency={row.original.currency} /> },
  {
    id: "recorded",
    header: "Recorded",
    cell: ({ row }) => (
      // May wrap (name, then date and time): at 1440 px the Actions column then fits without a sideways scroll.
      <span className="block min-w-[88px] text-xs text-muted-foreground">
        {row.original.recordedBy || "–"}
        <span className="block">{formatDateTime(row.original.recordedAt)}</span>
      </span>
    ),
  },
  ...(canVoid
    ? [
        {
          id: "actions",
          header: "Actions",
          meta: { className: "w-[72px]" },
          cell: ({ row }) =>
            row.original.entryType === "payment" && row.original.paymentId ? <VoidPaymentButton payment={voidable(row.original, supplier)} voided={!!row.original.payment?.voided} /> : null,
        } satisfies ColumnDef<LedgerEntry>,
      ]
    : []),
];

const orderColumns = (linkPo: boolean): ColumnDef<LedgerOrder>[] => {
  const money = (value: number | null, order: LedgerOrder) => moneyOrDash(value, (v) => amountOf(v, order.currency));
  return [
    { accessorKey: "po", header: "PO", cell: ({ row }) => <PoLink po={row.original.po} linked={linkPo} /> },
    { accessorKey: "orderDate", header: "Order date", cell: ({ row }) => formatDate(row.original.orderDate) },
    { accessorKey: "stage", header: "Stage", cell: ({ row }) => stageLabel(row.original.stage) },
    { accessorKey: "valueCny", header: "Order value (received)", meta: right, cell: ({ row }) => money(row.original.valueCny, row.original) },
    { accessorKey: "settledCny", header: "Settled", meta: right, cell: ({ row }) => money(row.original.settledCny, row.original) },
    { accessorKey: "outstandingCny", header: "Outstanding", meta: right, cell: ({ row }) => money(row.original.outstandingCny, row.original) },
    { id: "status", header: "Status", cell: ({ row }) => <PaymentStatusPill status={row.original.paymentStatus} held={row.original.held} /> },
    {
      id: "deposit",
      header: "Deposit required",
      cell: ({ row }) =>
        row.original.depositRequiredCny == null ? (
          DASH
        ) : (
          <span className="flex flex-col items-start gap-1">
            {money(row.original.depositRequiredCny, row.original)}
            <MilestonePill status={row.original.depositStatus} />
          </span>
        ),
    },
  ];
};

export const archiveColumns: ColumnDef<AdvanceArchiveEntry>[] = [
  { accessorKey: "entryDate", header: "Date", cell: ({ row }) => formatDate(row.original.entryDate) },
  {
    accessorKey: "kind",
    header: "Kind",
    cell: ({ row }) => {
      const label = ADVANCE_KIND_LABEL[row.original.kind] ?? row.original.kind;
      if (!row.original.exclusionReason) return label;
      // A receipt the owner excluded (a duplicate, a test entry): kept here as recorded, never on the account. Status and
      // reason sit in this early column so they show without scrolling the table on a phone.
      return (
        <span className="flex min-w-[190px] flex-col items-start gap-1">
          {label}
          <StatusPill tone="warning">{EXCLUDED_FROM_LEDGER}</StatusPill>
          <span className="text-[12.5px] leading-[16px] whitespace-normal text-muted-foreground">{row.original.exclusionReason}</span>
        </span>
      );
    },
  },
  { accessorKey: "po", header: "PO", cell: ({ row }) => row.original.po || DASH },
  {
    accessorKey: "amount",
    header: "Amount",
    meta: right,
    cell: ({ row }) => <span className={row.original.exclusionReason ? "text-muted-foreground" : undefined}>{amountOf(row.original.amount, row.original.currency)}</span>,
  },
  { accessorKey: "exchangeRate", header: "Rate (INR)", meta: right, cell: ({ row }) => (row.original.exchangeRate === null ? DASH : formatRateInr(row.original.exchangeRate)) },
  { accessorKey: "amountInr", header: "INR", meta: right, cell: ({ row }) => moneyOrDash(row.original.amountInr, (v) => formatINR(v, 2)) },
  { accessorKey: "mode", header: "Mode", cell: ({ row }) => row.original.mode || DASH },
  { accessorKey: "reference", header: "Reference", cell: ({ row }) => row.original.reference || DASH },
  { accessorKey: "notes", header: "Notes", cell: ({ row }) => row.original.notes || DASH },
  { accessorKey: "recordedBy", header: "Recorded by", cell: ({ row }) => row.original.recordedBy || DASH },
];

/** A read-only statement (no Void), newest first: the supplier report (RPT-5D) and the order report (RPT-O1) show it. */
export function LedgerStatementTable({ entries, supplier, linkPo, pageSize = 15 }: { entries: LedgerEntry[]; supplier: string; linkPo: boolean; pageSize?: number }) {
  const manyCurrencies = new Set(entries.map((e) => e.currency)).size > 1;
  return (
    <DataTable
      columns={statementColumns(supplier, linkPo, false, manyCurrencies)}
      data={entries}
      getRowId={(entry) => entry.id}
      size="sm"
      header="tall"
      emptyState="No entries yet."
      pagination={{ pageSize, itemLabel: "entries" }}
    />
  );
}

export function AccountCard({ account }: { account: LedgerAccount }) {
  const money = (value: number | null) => moneyOrDash(value, (v) => amountOf(v, account.currency));
  return (
    <KpiCard
      size="xs"
      label={`${account.currency} account`}
      value={account.held || account.balanceCny === null ? <span className="text-xl">{HELD_BALANCE}</span> : <BalanceFigure balance={account.balanceCny} currency={account.currency} inline />}
      sub={account.held ? HELD_MESSAGE : `Credits ${money(account.creditsCny)} · debits ${money(account.debitsCny)} · ${account.openOrders} open order${account.openOrders === 1 ? "" : "s"}`}
    />
  );
}

/** A held account's raw legacy records (D4): read-only, counted nowhere. */
function HeldRecords({ held }: { held: HeldAccount }) {
  const money = (value: number) => amountOf(value, held.currency);
  return (
    <SectionCard title={`${held.currency} records pending review (read-only)`} aside={<CardNote size="sm">Not posted · counted in no total</CardNote>} titleGap="none">
      <div className="mt-3 flex flex-col gap-3 text-[13.5px]">
        <RawList title="Orders" items={held.orders.map((o) => `${o.po} · ${formatDate(o.orderDate)} · ${money(o.valueCny)} · ${stageLabel(o.stage)}`)} />
        <RawList
          title="Payments"
          items={held.payments.map((p) => `${p.paidOn ? formatDate(p.paidOn) : "due"} · ${p.po} · ${p.kind}${p.payeeRole === "agent" ? " (agent)" : ""} · ${money(p.amountCny)}${p.mode ? ` · ${p.mode}` : ""}${p.reference ? ` · ${p.reference}` : ""}`)}
        />
        <RawList title="Advance entries" items={held.advanceEntries.map((a) => `${formatDate(a.entryDate)} · ${ADVANCE_KIND_LABEL[a.kind as keyof typeof ADVANCE_KIND_LABEL] ?? a.kind} · ${money(a.amount)}${a.po ? ` · ${a.po}` : ""}`)} />
      </div>
    </SectionCard>
  );
}
function RawList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="font-bold">{title}</h3>
      {items.length ? (
        <ul className="mt-1 list-inside list-disc text-muted-foreground">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-muted-foreground">None.</p>
      )}
    </div>
  );
}

const TYPE_OPTIONS = [
  { value: ALL, label: "All entries" },
  { value: "audit", label: "Voids and adjustments" },
  ...(Object.keys(ENTRY_LABEL) as LedgerEntryType[]).map((type) => ({ value: type, label: ENTRY_LABEL[type] })),
];

export function SupplierLedgerScreen({ data }: { data: SupplierLedgerData }) {
  const { ledger, advances, deposits, today, canEnter, canFull, linkPo } = data;
  const { supplier, accounts, entries, orders, held, currencyOptions } = ledger;
  const [tab, setTab] = useState<Tab>("statement");
  const [currency, setCurrency] = useState<string>(ALL);
  const [type, setType] = useState<string>(ALL);
  const filters: StatementFilters = { currency: currency === ALL ? null : currency, type: type === ALL ? null : (type as StatementFilters["type"]) };
  const shown = filterEntries(entries, filters);
  const currencies = [...new Set(entries.map((e) => e.currency))];
  const choice = paymentChoice(ledger);
  const label = describeFilters([`Supplier: ${supplier.name}`, filters.currency && `Currency: ${filters.currency}`, type !== ALL && `Entries: ${TYPE_OPTIONS.find((o) => o.value === type)?.label}`]);

  return (
    <>
      <PageHeader
        title={supplier.name}
        parent={{ label: "Supplier ledger", href: "/supplier-ledger" }}
        titleAddon={
          <>
            {supplier.code ? <span className="text-sm text-muted-foreground">{supplier.code}</span> : null}
            {supplier.status === "Inactive" ? <StatusPill tone="neutral">Inactive</StatusPill> : null}
          </>
        }
        actions={
          <>
            <ReportDownload file={() => statementFile(ledger, shown, label, today, advances)} />
            {canFull && currencyOptions.length ? (
              <AdjustmentDialog
                supplier={{ id: supplier.id, name: supplier.name, currency: supplier.currency, exchangeRate: supplier.exchangeRate, currencyOptions, balances: choice.balances }}
              >
                {/* Icon only on a phone, as Download report: three labelled actions leave no room for the title there. */}
                <Button type="button" variant="outline" size="header" className="max-sm:px-2.5">
                  <SlidersHorizontal aria-hidden className="size-4 sm:hidden" />
                  <span className="max-sm:sr-only">Adjust balance</span>
                </Button>
              </AdjustmentDialog>
            ) : null}
            {canEnter && supplier.status !== "Inactive" ? (
              <RecordPaymentDialog suppliers={[choice]} supplierId={supplier.id} canApprove={canFull}>
                <Button type="button" size="header" aria-label="+ Record payment" className="max-sm:px-3">
                  +<span className="max-sm:sr-only"> Record payment</span>
                </Button>
              </RecordPaymentDialog>
            ) : null}
          </>
        }
      />
      <PageContainer>
        {held.map((h) => (
          <Callout key={h.currency} tone="warning" size="sm" role="status">
            <strong>{HELD_MESSAGE}</strong> {h.currency}: {HELD_BALANCE}.{h.reason ? ` ${h.reason}${/[.!?]$/.test(h.reason.trim()) ? "" : "."}` : ""} Its records are listed below, read-only, and count in no
            total.
          </Callout>
        ))}
        {accounts.length ? (
          <KpiRow gap="sm">
            {accounts.map((account) => (
              <AccountCard key={account.currency} account={account} />
            ))}
          </KpiRow>
        ) : (
          <EmptyState title={`No entries on ${supplier.name}'s account yet.`} />
        )}

        <SectionCard titleGap="none" className="min-w-0">
          <div role="tablist" aria-label="Ledger sections" className="-mx-1 flex gap-1 overflow-x-auto border-b">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`ledger-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`ledger-panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={cn(
                  "shrink-0 border-b-2 px-3 py-2.5 text-sm font-bold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`ledger-panel-${tab}`} aria-labelledby={`ledger-tab-${tab}`} className="mt-3">
            {tab === "statement" ? (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  {currencies.length > 1 ? (
                    <FilterSelect label="Currency" showLabel size="sm" value={currency} options={[{ value: ALL, label: "All currencies" }, ...currencies.map((c) => ({ value: c, label: c }))]} onValueChange={setCurrency} />
                  ) : null}
                  <FilterSelect label="Entries" showLabel size="sm" value={type} options={TYPE_OPTIONS} onValueChange={setType} />
                  <CardNote size="sm">Newest first · balance after each entry, by date</CardNote>
                </div>
                <DataTable
                  key={JSON.stringify(filters)}
                  columns={statementColumns(supplier.name, linkPo, canFull, currencies.length > 1)}
                  data={shown}
                  getRowId={(entry) => entry.id}
                  size="sm"
                  header="tall"
                  emptyState={entries.length ? "No entries match these filters." : "No entries yet."}
                  pagination={{ pageSize: 15, itemLabel: "entries" }}
                />
              </>
            ) : tab === "orders" ? (
              <>
                <CardNote size="sm" className="mb-3 block">
                  Oldest first: the account settles them in this order. Outstanding is never below zero.
                </CardNote>
                <DataTable columns={orderColumns(linkPo)} data={orders} getRowId={(order) => order.id} size="sm" header="tall" emptyState="No orders for this supplier." />
              </>
            ) : tab === "advance" ? (
              advances === null ? (
                <EmptyState title="The legacy advance history couldn't be loaded." />
              ) : advances.entries.length === 0 ? (
                <EmptyState title="No legacy advance history." />
              ) : (
                <>
                  <CardNote size="sm" className="mb-3 block">
                    Archive, read-only: advance receipts are on the account as payments, except any marked {EXCLUDED_FROM_LEDGER}; the other rows are
                    kept for reference only.
                  </CardNote>
                  <DataTable columns={archiveColumns} data={advances.entries} getRowId={(entry) => entry.id} size="sm" header="tall" pagination={{ pageSize: 15, itemLabel: "entries" }} />
                </>
              )
            ) : deposits === null ? (
              <EmptyState title="The supplier deposits couldn't be loaded." />
            ) : (
              <DepositsArchive statement={deposits} />
            )}
          </div>
        </SectionCard>

        {held.map((h) => (
          <HeldRecords key={h.currency} held={h} />
        ))}
      </PageContainer>
    </>
  );
}
