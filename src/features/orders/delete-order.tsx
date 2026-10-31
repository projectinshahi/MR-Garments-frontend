"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { handleApiError, notifySuccess } from "@/lib/feedback";
import { cn } from "@/lib/utils";

// ORD-6 (docs/orders-users-contract.md). Proposed wording.
export const DELETE_ORDER_TEXT = {
  deleted: "Order deleted",
  alreadyDeleted: "Order was already deleted.",
};

/** The text actions in a table row, as the Settings and Users lists draw "Edit". */
export const rowActionClass = "inline-block rounded-sm font-bold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * "Delete order" and its confirmation; Cancel calls nothing. The API decides: an order with payments, receipts or
 * container loads is refused (409 `in_use`) and the same dialog explains why with Close only (an order has no
 * deactivate). A 404 means it was deleted already, which ends like a delete. Any other failure toasts and keeps the
 * dialog open, so confirming again retries. On the order page (default) a delete goes to the list; `inList` draws the
 * row's text action and only reloads the list.
 */
export function DeleteOrderButton({ po, supplier, inList = false }: { po: string; supplier: string; inList?: boolean }) {
  const router = useRouter();
  // null: closed. "ask": the confirmation. An object: the API's reason the order can't be deleted.
  const [step, setStep] = useState<null | "ask" | { inUse: string }>(null);

  function done(message: string) {
    setStep(null);
    notifySuccess(message);
    if (!inList) router.replace("/orders");
    router.refresh();
  }
  async function remove() {
    try {
      await apiClient.delete(`/orders/${encodeURIComponent(po)}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return done(DELETE_ORDER_TEXT.alreadyDeleted);
      if (error instanceof ApiError && error.status === 409 && error.code === "in_use") return setStep({ inUse: error.message });
      handleApiError(error);
      return;
    }
    done(DELETE_ORDER_TEXT.deleted);
  }

  const inUse = typeof step === "object" && step !== null ? step.inUse : null;
  const dialog =
    inUse === null
      ? {
          tone: "danger" as const,
          title: "Delete order?",
          description: (
            <p>
              Are you sure you want to delete <strong className="text-foreground">{po}</strong> ({supplier})? This can&apos;t be undone. An order with
              payments, receipts or container loads can&apos;t be deleted.
            </p>
          ),
          confirmLabel: "Delete order",
          pendingLabel: "Deleting…",
          onConfirm: remove,
        }
      : { title: "Can't delete order", description: <p>{inUse}</p> };

  return (
    <>
      {inList ? (
        <button type="button" aria-label={`Delete ${po}`} className={cn(rowActionClass, "text-danger")} onClick={() => setStep("ask")}>
          Delete
        </button>
      ) : (
        // As Edit order: "Delete" on a phone, so the PO title isn't truncated; the name stays "Delete order".
        <Button variant="destructive" aria-label="Delete order" onClick={() => setStep("ask")}>
          Delete<span className="max-sm:hidden"> order</span>
        </Button>
      )}
      <ConfirmDialog open={step !== null} onCancel={() => setStep(null)} {...dialog} />
    </>
  );
}
