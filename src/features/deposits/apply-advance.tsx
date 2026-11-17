"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import type { AdvanceResult } from "@/lib/api/types";
import { handleApiError, notifySuccess } from "@/lib/feedback";
import { formatMoney } from "@/lib/formatters";
import type { Currency } from "@/types/domain";

// ADV-4 (backend docs/supplier-advance.md): applies the supplier's available advance to an order placed before the
// advance was recorded. New orders draw on it by themselves; an existing order only when someone asks, here. The server
// applies up to what the order still owes and writes nothing on a repeat, so a double click never applies twice.

/** What ADV-4 will apply: the smaller of the advance available and the order's balance. */
export const advanceToApply = (availableCny: number, balanceCny: number) => Math.max(0, Math.min(availableCny, balanceCny));

export function ApplyAdvanceButton({ po, currency, availableCny, balanceCny }: { po: string; currency: Currency; availableCny: number; balanceCny: number }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const money = (value: number) => formatMoney(value, currency, { decimals: 2 });
  const applies = advanceToApply(availableCny, balanceCny);

  async function apply() {
    try {
      const { advance } = await apiClient.post<{ advance: AdvanceResult }>(`/orders/${encodeURIComponent(po)}/advance`);
      notifySuccess(advance.changeCny > 0 ? `${money(advance.changeCny)} of supplier advance applied to ${po}` : `Nothing more to apply to ${po}`);
    } catch (error) {
      handleApiError(error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" aria-label={`Apply supplier advance to ${po}`} onClick={() => setOpen(true)}>
        Apply advance
      </Button>
      <ConfirmDialog
        open={open}
        tone="confirm"
        title={`Apply supplier advance to ${po}?`}
        description={
          <p>
            {money(applies)} of the supplier&apos;s {money(availableCny)} available advance will be applied to this order.{" "}
            {balanceCny > applies ? `${money(balanceCny - applies)} will still be to pay.` : "Nothing will be left to pay."}
          </p>
        }
        confirmLabel={`Apply ${money(applies)}`}
        pendingLabel="Applying…"
        onConfirm={apply}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
