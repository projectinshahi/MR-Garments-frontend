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
 * A record's "Delete" on the order page (REC-4 a receipt, CON-6 a container) and its confirmation; Cancel calls
 * nothing. The API decides: what still depends on the record is refused (409 `in_use`) and the same dialog explains why
 * with Close only. A 404 means it was deleted already, which ends like a delete. Any other failure toasts and keeps the
 * dialog open, so confirming again retries. Done: a toast and a refresh, so the order's figures and stage follow.
 * Proposed wording.
 */
export function DeleteRecordButton({
  path,
  noun,
  label,
  title,
  description,
}: {
  /** The DELETE path, "/receipts/<id>" or "/containers/<id>". */
  path: string;
  noun: "receipt" | "container";
  /** The button's accessible name, naming the record ("Delete receipt of 3 Oct 2026"). */
  label: string;
  title: string;
  description: React.ReactNode;
}) {
  const router = useRouter();
  // null: closed. "ask": the confirmation. An object: the API's reason the record can't be deleted.
  const [step, setStep] = useState<null | "ask" | { inUse: string }>(null);
  const Noun = `${noun[0]!.toUpperCase()}${noun.slice(1)}`;

  function done(message: string) {
    setStep(null);
    notifySuccess(message);
    router.refresh();
  }
  async function remove() {
    try {
      await apiClient.delete(path);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return done(`${Noun} was already deleted.`);
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
      <button type="button" aria-label={label} className={cn(rowActionClass, "text-danger")} onClick={() => setStep("ask")}>
        Delete
      </button>
      <ConfirmDialog open={step !== null} onCancel={() => setStep(null)} {...dialog} />
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
