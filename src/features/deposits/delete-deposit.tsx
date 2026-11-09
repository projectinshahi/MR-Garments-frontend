"use client";

import { DeleteRecordButton, RecordFacts } from "@/features/order-detail/shared/delete-record";
import type { DepositTransaction, SupplierDepositRow } from "@/lib/api/deposits-types";
import { formatDate } from "@/lib/formatters";

import { amountText, STATUS_LABEL } from "./deposits-logic";

// SD-4 and SD-5 (payments Full): the shared Delete button and confirmation (delete-record.tsx, as PAY-3 uses it). The
// API decides: a deposit with transactions is refused (409 in_use) and the dialog explains why. Proposed wording.

const DIRECTION = { give: "To give", receive: "To receive" } as const;
const round2 = (value: number) => Math.round(value * 100) / 100;

/** A payment (give) or receipt (receive) against a supplier deposit: deleting it raises the deposit's pending amount. */
export function DeleteTransactionButton({ transaction, deposit }: { transaction: DepositTransaction; deposit: SupplierDepositRow }) {
  const payment = deposit.direction === "give";
  const noun = payment ? "payment" : "receipt";
  const money = (value: number) => amountText(value, deposit.currency);
  return (
    <DeleteRecordButton
      path={`/supplier-deposit-transactions/${transaction.id}`}
      noun={noun}
      label={`Delete ${noun} of ${formatDate(transaction.paidOn)}, ${money(transaction.amount)}`}
      title={payment ? "Delete Payment?" : "Delete Receipt?"}
      description={
        <>
          <p>
            Are you sure you want to delete this {noun} against the deposit {payment ? "to give to" : "to receive from"}{" "}
            <strong className="text-foreground">{deposit.supplier}</strong>? This can&apos;t be undone.
          </p>
          <RecordFacts
            facts={[
              [payment ? "Paid on" : "Received on", formatDate(transaction.paidOn)],
              ["Amount", money(transaction.amount)],
              ["Mode", transaction.mode],
              ...(transaction.reference ? [["Reference", transaction.reference] satisfies [string, string]] : []),
              ["Deposit", `${DIRECTION[deposit.direction]} · ${money(deposit.amount)} · agreed ${formatDate(deposit.openedOn)}`],
            ]}
          />
          <p className="font-bold text-foreground">
            Settled goes from {money(deposit.settled)} to {money(round2(deposit.settled - transaction.amount))}, and pending from {money(deposit.pending)} to{" "}
            {money(round2(deposit.pending + transaction.amount))}.
          </p>
          <p>The deposit and its other {payment ? "payments" : "receipts"} stay. Order payments and figures are not involved.</p>
        </>
      }
    />
  );
}

/** A supplier deposit nothing was settled against; with transactions, Delete opens the "can't delete" explanation instead. */
export function DeleteDepositButton({ deposit }: { deposit: SupplierDepositRow }) {
  const money = (value: number) => amountText(value, deposit.currency);
  const n = deposit.transactions;
  return (
    <DeleteRecordButton
      path={`/supplier-deposits/${deposit.id}`}
      noun="deposit"
      label={`Delete deposit of ${formatDate(deposit.openedOn)}, ${money(deposit.amount)}`}
      title="Delete Deposit?"
      refused={n > 0 ? <p>This deposit has {n} transaction{n === 1 ? "" : "s"}, so it can&apos;t be deleted. Delete them first if the deposit was recorded by mistake.</p> : undefined}
      description={
        <>
          <p>
            Are you sure you want to delete this deposit {deposit.direction === "give" ? "to give to" : "to receive from"}{" "}
            <strong className="text-foreground">{deposit.supplier}</strong>? This can&apos;t be undone.
          </p>
          <RecordFacts
            facts={[
              ["Direction", DIRECTION[deposit.direction]],
              ["Amount", money(deposit.amount)],
              ["Agreed on", formatDate(deposit.openedOn)],
              ...(deposit.reference ? [["Reference", deposit.reference] satisfies [string, string]] : []),
              ["Status", STATUS_LABEL[deposit.status]],
            ]}
          />
          <p>Nothing was settled against it, so no figure changes. Order payments are not involved.</p>
        </>
      }
    />
  );
}
