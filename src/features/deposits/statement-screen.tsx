"use client";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { CardNote, KpiCard, KpiRow, SectionCard } from "@/components/shared/cards";
import { KeyValueList } from "@/components/shared/key-value-list";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { ExportActions } from "@/features/reports/report-actions";
import type { SupplierDepositRow, SupplierStatement } from "@/lib/api/deposits-types";
import { currencyTitle, formatDate } from "@/lib/formatters";
import type { MoneyTotal } from "@/types/domain";

import type { StatementData } from "./data/queries";
import { DeleteDepositButton, DeleteTransactionButton } from "./delete-deposit";
import { statementFile } from "./deposit-files";
import { NewDepositDialog, SettleDepositDialog } from "./deposit-dialogs";
import { amountList, amountText, STATUS_LABEL, STATUS_TONE, statementTotals } from "./deposits-logic";

// A supplier's deposit statement (SD-1), no reference design: the supplier, six figures (give and receive are never
// netted), each deposit with its transactions stacked under it (oldest first), the dialogs and Delete for Management.

type Deposit = SupplierStatement["deposits"][number];
const DIRECTION = { give: "To give", receive: "To receive" } as const;
const orDash = (value: string) => value.trim() || "–";
/** Per currency, "–" when the direction has no deposits. */
const list = (amounts: MoneyTotal[]) => (amounts.length ? amountList(amounts) : "–");

export function StatementScreen({ data }: { data: StatementData }) {
  const { statement, today, canEnter, canDelete } = data;
  const { supplier, summary, deposits } = statement;
  const give = statementTotals(summary, "give");
  const receive = statementTotals(summary, "receive");

  return (
    <>
      <PageHeader
        title={supplier.name}
        parent={{ label: "Deposits", href: "/deposits/suppliers" }}
        titleAddon={supplier.status === "Inactive" ? <StatusPill tone="neutral">Inactive</StatusPill> : undefined}
        actions={
          <>
            <ExportActions size="header" formats={["xlsx", "pdf"]} file={() => statementFile(statement, today)} />
            {canEnter ? (
              <NewDepositDialog supplier={supplier}>
                <Button type="button" size="header">
                  + New deposit
                </Button>
              </NewDepositDialog>
            ) : null}
          </>
        }
      />
      <PageContainer>
        <SectionCard title="Supplier">
          <div className="grid gap-x-10 lg:grid-cols-2">
            <KeyValueList
              boldValues
              items={[
                { label: "Contact person", value: orDash(supplier.contactPerson) },
                { label: "Phone", value: orDash(supplier.phone) },
              ]}
            />
            <KeyValueList
              boldValues
              className="border-t border-border-subtle lg:border-t-0"
              items={[
                { label: "City", value: orDash(supplier.city) },
                { label: "Default currency", value: currencyTitle(supplier.currency) },
              ]}
            />
          </div>
        </SectionCard>
        {/* Two rows, never combined: what we owe the supplier, and what the supplier owes us. */}
        <KpiRow gap="sm">
          <KpiCard size="xs" label="To give" value={list(give.amount)} sub="deposits we owe the supplier" />
          <KpiCard size="xs" label="Given" value={list(give.paid)} sub="paid so far" />
          <KpiCard size="xs" label="Pending to give" value={list(give.pending)} sub="still to pay" />
        </KpiRow>
        <KpiRow gap="sm">
          <KpiCard size="xs" label="To receive" value={list(receive.amount)} sub="deposits the supplier owes us" />
          <KpiCard size="xs" label="Received" value={list(receive.paid)} sub="received so far" />
          <KpiCard size="xs" label="Pending to receive" value={list(receive.pending)} sub="still to receive" />
        </KpiRow>
        <SectionCard title="Deposits" aside={<CardNote size="sm">Newest first · transactions oldest first</CardNote>} bottomGap="form">
          {deposits.length === 0 ? (
            <p className="text-[13.5px] text-muted-foreground">No deposits with {supplier.name} yet.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {deposits.map((deposit) => (
                <li key={deposit.id}>
                  <DepositBlock deposit={deposit} canEnter={canEnter} canDelete={canDelete} />
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </PageContainer>
    </>
  );
}

function DepositBlock({ deposit, canEnter, canDelete }: { deposit: Deposit; canEnter: boolean; canDelete: boolean }) {
  const money = (value: number) => amountText(value, deposit.currency);
  const give = deposit.direction === "give";
  const facts = [
    { label: "Agreed on", value: formatDate(deposit.openedOn) },
    { label: "Amount", value: money(deposit.amount) },
    { label: give ? "Paid" : "Received", value: money(deposit.settled) },
    { label: "Pending", value: money(deposit.pending) },
    ...(deposit.reference ? [{ label: "Reference", value: deposit.reference }] : []),
    ...(deposit.notes ? [{ label: "Notes", value: deposit.notes }] : []),
  ];
  // SD-1 lists transactions newest first; the block reads them oldest first, numbered.
  const transactions = deposit.transactions.toReversed();
  // The dialogs and Delete take the list row (the count in place of the transactions).
  const row: SupplierDepositRow = { ...deposit, transactions: deposit.transactions.length };

  return (
    <article className="rounded-[10px] border bg-input-background px-4 py-[13px]" aria-label={`${DIRECTION[deposit.direction]} ${money(deposit.amount)} agreed ${formatDate(deposit.openedOn)}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[14.5px] leading-[17px] font-bold">
          {DIRECTION[deposit.direction]} · {money(deposit.amount)}
        </h3>
        <div className="flex items-center gap-3">
          <StatusPill tone={STATUS_TONE[deposit.status]}>{STATUS_LABEL[deposit.status]}</StatusPill>
          {canEnter && deposit.pending > 0 ? (
            <SettleDepositDialog deposit={row}>
              <Button type="button" size="sm">
                {give ? "Record payment" : "Record receipt"}
              </Button>
            </SettleDepositDialog>
          ) : null}
          {canDelete ? <DeleteDepositButton deposit={row} /> : null}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3.5 gap-y-2.5 sm:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.label} className={fact.label === "Notes" ? "col-span-2 sm:col-span-4" : undefined}>
            <dt className="text-[12.5px] leading-[15px] text-muted-foreground">{fact.label}</dt>
            <dd className="text-[14.5px] leading-[17px] font-bold [overflow-wrap:anywhere]">{fact.value}</dd>
          </div>
        ))}
      </dl>
      {transactions.length ? (
        <ol className="mt-3 flex flex-col divide-y divide-border-subtle rounded-lg border border-dashed border-placeholder/60 bg-card px-3" aria-label={give ? "Payments" : "Receipts"}>
          {transactions.map((transaction, index) => (
            <li key={transaction.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-[13.5px]">
              <span>
                <span className="font-bold">
                  {index + 1}. {formatDate(transaction.paidOn)} · {money(transaction.amount)}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {transaction.mode}
                  {transaction.reference ? ` · ${transaction.reference}` : ""}
                  {transaction.notes ? ` · ${transaction.notes}` : ""}
                </span>
              </span>
              {canDelete ? <DeleteTransactionButton transaction={transaction} deposit={row} /> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </article>
  );
}
