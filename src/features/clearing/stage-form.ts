import { useRouter } from "next/navigation";
import { useState } from "react";

import type { TimelineItem } from "@/components/shared/timeline";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { handleApiError, notifyError, notifySuccess } from "@/lib/feedback";
import { formatINR, formatNumber } from "@/lib/formatters";

// What the three stage forms share (Clearing 25, Transport 27, Receive goods 29): progress steps, INR fields and the
// save flow (CLR-3, TRN-3, WH-3 take `complete: false` for "Save draft" and `true` for the final action).

/**
 * Progress from the saved record: a done step gets a check, the first open step is current (its detail, or
 * "Waiting"), later open steps are pending. Open steps are numbered by position.
 */
export function progressSteps(steps: { title: string; done: boolean; detail?: string }[]): TimelineItem[] {
  const current = steps.findIndex((step) => !step.done);
  return steps.map(({ title, done, detail }, index) =>
    done
      ? { title, detail, marker: "check" }
      : index === current
        ? { title, detail: detail ?? "Waiting", marker: "current", number: index + 1 }
        : { title, detail, marker: "pending", number: index + 1 },
  );
}

/** What an INR field keeps of the typed text: digits, one dot and at most 2 decimals ("98000.5"). */
export function cleanAmount(typed: string) {
  const [whole = "", ...rest] = typed.replace(/[^\d.]/g, "").split(".");
  return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}

/** The field's text, with Indian grouping of the whole part ("98,000.5"). */
export function showAmount(value: string) {
  if (!value) return "";
  const [whole = "", decimals] = value.split(".");
  return `${formatNumber(Number(whole))}${decimals === undefined ? "" : `.${decimals}`}`;
}

/** INR with paise only when there are any ("₹3,70,500", "₹1,450.50"). */
export const formatExactINR = (value: number) => formatINR(value, Number.isInteger(Math.round(value * 100) / 100) ? 0 : 2);
/** An INR field's value for the API: 0 when empty. */
export const amountOf = (value: string) => (value ? Number(value) : 0);
/** A date field's value for the API: null when empty. */
export const dateOf = (value: string) => value || null;
/** A saved amount as field text ("" for none). */
export const amountText = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));

/**
 * PUTs the form to `path`. Field errors (422) for `fields` go under those fields, others are toasted; a 409 without
 * fields (another user completed the record, or the stage before isn't done) is toasted and the page refreshed.
 * After saving: a toast, then the list (`doneHref`) for the final action or a refresh for a draft.
 */
export function useStageSave(path: string, fields: readonly string[], saved: { draft: string; complete: string }, doneHref: string) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function save(body: object, complete: boolean) {
    setSaving(true);
    try {
      await apiClient.put(path, { ...body, complete });
    } catch (error) {
      const problems = Object.entries(handleApiError(error) ?? {});
      setErrors(Object.fromEntries(problems.filter(([key]) => fields.includes(key))));
      problems.filter(([key]) => !fields.includes(key)).forEach(([, message]) => notifyError(message));
      if (error instanceof ApiError && error.status === 409 && !error.fields) router.refresh();
      setSaving(false);
      return;
    }
    setErrors({});
    notifySuccess(complete ? saved.complete : saved.draft);
    if (complete) router.push(doneHref);
    router.refresh();
    setSaving(false);
  }

  return { errors, saving, save };
}
