"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { rowActionClass } from "@/features/orders/delete-order";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { handleApiError, notifySuccess } from "@/lib/feedback";
import { cn } from "@/lib/utils";

/**
 * A list's Actions column (Containers, Clearing, Transport, Warehouse). Below lg the table scrolls inside its card, so
 * the column stays pinned at the right edge and Delete is always in view; header and totals cells keep the table-head
 * colour. PLAIN_ACTIONS_COLUMN_CLASS: the same in a `variant="plain"` table, whose header is white.
 */
export const PLAIN_ACTIONS_COLUMN_CLASS = "max-lg:sticky max-lg:right-0 max-lg:z-10 max-lg:bg-card max-lg:shadow-[inset_1px_0_0_var(--border)]";
export const ACTIONS_COLUMN_CLASS = `${PLAIN_ACTIONS_COLUMN_CLASS} [&:is(th)]:bg-table-head [tfoot_&]:bg-table-head`;

/**
 * A record's "Delete" (REC-4 a receipt, CON-6 a container, CLR-4 a clearing, TRN-4 a trip, WH-4 a warehouse receipt)
 * and its confirmation; Cancel calls
 * nothing. The API decides: what still depends on the record is refused (409 `in_use`) and the same dialog explains why
 * with Close only. Its own 404 means it was deleted already, which ends like a delete. Any other failure toasts and keeps the
 * dialog open, so confirming again retries. Done: a toast and a refresh, so the order's figures and stage follow.
 * `opened`: mounted already asking, without its own button (a menu picked the record); `onClosed` runs when the dialog
 * closes, whichever way. Proposed wording.
 */
export function DeleteRecordButton({
  path,
  noun,
  label,
  title,
  description,
  opened = false,
  onClosed,
}: {
  /** The DELETE path, "/receipts/<id>" or "/containers/<id>". */
  path: string;
  noun: "receipt" | "container" | "clearing" | "trip" | "warehouse receipt" | "deposit" | "payment";
  /** The button's accessible name, naming the record ("Delete receipt of 3 Oct 2026"). */
  label: string;
  title: string;
  description: React.ReactNode;
  opened?: boolean;
  onClosed?: () => void;
}) {
  const router = useRouter();
  // null: closed. "ask": the confirmation. An object: the API's reason the record can't be deleted.
  const [step, setStep] = useState<null | "ask" | { inUse: string }>(opened ? "ask" : null);
  const Noun = `${noun[0]!.toUpperCase()}${noun.slice(1)}`;

  function close() {
    setStep(null);
    onClosed?.();
  }
  function done(message: string) {
    close();
    notifySuccess(message);
    router.refresh();
  }
  async function remove() {
    try {
      await apiClient.delete(path);
    } catch (error) {
      // The record's own 404 ("Receipt not found.", "Payment not found." for a deposit too) means it is gone; "Endpoint
      // not found." is a backend without the delete.
      if (error instanceof ApiError && error.status === 404 && error.message !== "Endpoint not found.") return done(`${Noun} was already deleted.`);
      if (error instanceof ApiError && error.status === 409 && error.code === "in_use") return setStep({ inUse: error.message });
      handleApiError(error);
      return;
    }
    done(`${Noun} deleted`);
  }

  const inUse = typeof step === "object" && step !== null ? step.inUse : null;
  const dialog =
    inUse === null
      ? { tone: "danger" as const, title, description, confirmLabel: `Delete ${noun}`, pendingLabel: "Deleting…", onConfirm: remove }
      : { title: `Can't delete ${noun}`, description: <p>{inUse}</p> };

  return (
    <>
      {opened ? null : (
        <button type="button" aria-label={label} className={cn(rowActionClass, "text-danger")} onClick={() => setStep("ask")}>
          Delete
        </button>
      )}
      <ConfirmDialog open={step !== null} onCancel={close} {...dialog} />
    </>
  );
}

/** The record's facts in the confirmation: label and value pairs. */
export function RecordFacts({ facts }: { facts: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 rounded-lg border px-3.5 py-2.5">
      {facts.map(([label, value]) => (
        <div key={label} className="contents">
          <dt>{label}</dt>
          <dd className="font-bold text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
