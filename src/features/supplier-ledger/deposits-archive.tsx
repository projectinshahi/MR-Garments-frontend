import { KpiCard, KpiRow } from "@/components/shared/cards";
import { EmptyState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { amountList, amountText, STATUS_LABEL, STATUS_TONE, statementTotals } from "@/features/deposits/deposits-logic";
import type { SupplierStatement } from "@/lib/api/deposits-types";
import { formatDate, formatINR, rateText } from "@/lib/formatters";
import type { MoneyTotal } from "@/types/domain";

// The supplier-deposit archive (SD-1, D8): read-only since the unified ledger. Give and receive are never netted, and
// nothing here is on the supplier's account.

type Deposit = SupplierStatement["deposits"][number];
const DIRECTION = { give: "To give", receive: "To receive" } as const;
const list = (amounts: MoneyTotal[]) => (amounts.length ? amountList(amounts) : "–");

export function DepositsArchive({ statement }: { statement: SupplierStatement }) {
  const { supplier, summary, deposits } = statement;
  const give = statementTotals(summary, "give");
  const receive = statementTotals(summary, "receive");
  if (deposits.length === 0) return <EmptyState title={`No supplier deposits with ${supplier.name}.`} />;
  return (
    <div className="flex flex-col gap-3">
      <KpiRow gap="sm">
        <KpiCard size="xs" label="To give" value={list(give.amount)} sub={`given ${list(give.paid)} · pending ${list(give.pending)}`} />
        <KpiCard size="xs" label="To receive" value={list(receive.amount)} sub={`received ${list(receive.paid)} · pending ${list(receive.pending)}`} />
      </KpiRow>
      <ol className="flex flex-col gap-3">
        {deposits.map((deposit) => (
          <li key={deposit.id}>
            <DepositBlock deposit={deposit} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function DepositBlock({ deposit }: { deposit: Deposit }) {
  const money = (value: number) => amountText(value, deposit.currency);
  const give = deposit.direction === "give";
  const facts = [
    { label: "Agreed on", value: formatDate(deposit.openedOn) },
    { label: "Amount", value: money(deposit.amount) },
    ...(deposit.currency !== "INR" && deposit.exchangeRate != null
      ? [{ label: "Rate when opened", value: rateText(deposit.currency, deposit.exchangeRate) }, { label: "INR equivalent", value: deposit.amountInr == null ? "–" : formatINR(deposit.amountInr, 2) }]
      : []),
    { label: give ? "Paid" : "Received", value: money(deposit.settled) },
    { label: "Pending", value: money(deposit.pending) },
    ...(deposit.reference ? [{ label: "Reference", value: deposit.reference }] : []),
    ...(deposit.notes ? [{ label: "Notes", value: deposit.notes }] : []),
  ];
  // SD-1 lists transactions newest first; the block reads them oldest first, numbered.
  const transactions = deposit.transactions.toReversed();
  return (
    <article className="rounded-[10px] border bg-input-background px-4 py-[13px]" aria-label={`${DIRECTION[deposit.direction]} ${money(deposit.amount)} agreed ${formatDate(deposit.openedOn)}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[14.5px] leading-[17px] font-bold">
          {DIRECTION[deposit.direction]} · {money(deposit.amount)}
        </h3>
        <StatusPill tone={STATUS_TONE[deposit.status]}>{STATUS_LABEL[deposit.status]}</StatusPill>
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
            <li key={transaction.id} className="py-2 text-[13.5px]">
              <span className="font-bold">
                {index + 1}. {formatDate(transaction.paidOn)} · {money(transaction.amount)}
              </span>
              <span className="text-muted-foreground">
                {" "}
                · {transaction.mode}
                {transaction.reference ? ` · ${transaction.reference}` : ""}
                {transaction.notes ? ` · ${transaction.notes}` : ""}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </article>
  );
}
