"use client";

import { CircleAlertIcon, TriangleAlertIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { handleApiError, notifySuccess } from "@/lib/feedback";
import { cn } from "@/lib/utils";

// The Settings add/edit dialogs (tabs 1-7), Delete, and the deactivate and delete confirmations. Coordinator-owned;
// the tabs build their forms on it. Measured from 53_17.4_Add_supplier_(pop-up).jpeg: 21 px title over a 14 px description, 12.5 px bold
// labels 5 px above 42 px fields with 14 px text, 14 px between rows, 42 px footer buttons.

export const fieldClass = "gap-[5px]";
export const labelClass = "gap-0.5 text-[12.5px] leading-[15px] font-bold text-label";
export const footerButtonClass = "h-[42px] px-[17px]";

// Links to these use `replace`, as `close` does: the dialog is never a history entry of its own, so one Back press
// leaves the tab (a pushed dialog left a second copy of the tab behind, and Back seemed to do nothing).

/** Opens the tab's add dialog: `?dialog=add` on the tab's own path. */
export const addHref = (path: string) => `${path}?dialog=add`;
/** Opens the tab's edit dialog for one row: `?dialog=edit&id=<id>`. */
export const editHref = (path: string, id: string) => `${path}?dialog=edit&id=${encodeURIComponent(id)}`;

/**
 * Which dialog the URL opens on the tab at `path` (read with useSearchParams, so render inside <Suspense>).
 * `close` removes the parameters; `saved` toasts the success message, closes and reloads the list from the server
 * (K7). Only the tab's own path counts, so a tab kept mounted (hidden) by Activity never opens its dialog.
 */
export function useSettingsDialog(path: string) {
  const params = useSearchParams();
  const here = usePathname() === path;
  const router = useRouter();
  const dialog = here ? params.get("dialog") : null;
  const id = dialog === "edit" ? params.get("id") : null;
  // Only the URL changes, so replace it in place: Next keeps useSearchParams in sync with no server round trip, and the
  // dialog closes at once (router.replace waited for the page's server render while the dialog stayed up).
  const close = () => window.history.replaceState(null, "", path);
  return {
    open: dialog === "add" ? ("add" as const) : id ? ("edit" as const) : null,
    /** The row being edited, while `open` is "edit". */
    id,
    close,
    saved: (message: string) => {
      notifySuccess(message);
      close();
      router.refresh();
    },
  };
}

/**
 * The dialog frame: title, description and the form as children. The reference opens with no field focused, so the
 * dialog itself takes focus. Content unmounts on close, so a form inside opens from its defaults every time. While it
 * fades out it keeps what was open: the URL has already lost ?dialog=edit, so an edit dialog's caller now passes the
 * add title and an empty form.
 */
export function SettingsDialog({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const [shown, setShown] = useState({ title, description, children });
  if (open && (shown.title !== title || shown.description !== description || shown.children !== children)) {
    setShown({ title, description, children });
  }
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent
        className="gap-0 pb-[26px]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
        }}
      >
        <DialogHeader className="gap-[7px]">
          <DialogTitle className="text-[21px] leading-[19px]">{shown.title}</DialogTitle>
          <DialogDescription className="text-sm leading-5">{shown.description}</DialogDescription>
        </DialogHeader>
        {shown.children}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The record an edit dialog can delete: its API path (`/teams/<id>`), its name, its noun in lower case, whether it is
 * Active, and the tab's deactivate note (what deactivating changes), offered when the API refuses the delete.
 */
export type Deletable = { path: string; name: string; noun: string; active: boolean; deactivateNote: string };

const capitalised = (noun: string) => `${noun[0]!.toUpperCase()}${noun.slice(1)}`;
export const DELETE_TEXT = {
  deleted: (noun: string) => `${capitalised(noun)} deleted`,
  alreadyDeleted: (noun: string) => `${capitalised(noun)} was already deleted.`,
  deactivated: (noun: string) => `${capitalised(noun)} deactivated`,
  alreadyInactive: "It's already inactive, so it isn't offered on new records.",
};

/**
 * Cancel and the submit button, disabled while the request runs (E14: no spinner is designed). With `remove` (edit
 * dialogs), a Delete button on the left asks first (DeleteButton). A 404 means someone deleted it first: that closes
 * and reloads like a delete.
 */
export function SettingsDialogFooter({
  onCancel,
  submitLabel,
  submitting,
  remove,
}: {
  onCancel: () => void;
  submitLabel: string;
  submitting: boolean;
  remove?: Deletable;
}) {
  return (
    <DialogFooter className="mt-5 pt-4">
      {remove ? <DeleteButton record={remove} disabled={submitting} /> : null}
      <Button type="button" variant="outline" className={cn(footerButtonClass, "border-input")} onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" className={footerButtonClass} disabled={submitting}>
        {submitLabel}
      </Button>
    </DialogFooter>
  );
}

/**
 * Delete asks first ("Delete supplier?"); Cancel calls nothing. The API decides (BR-06): a record in use is refused
 * (409 `in_use`), and the same dialog turns into "Deactivate supplier instead?" with the API's reason and the tab's
 * deactivate note, or, for a record already inactive, explains and only closes. Any other failure toasts
 * (handleApiError) and keeps the dialog open, so confirming again retries. Success closes and reloads like a save.
 */
function DeleteButton({ record, disabled }: { record: Deletable; disabled: boolean }) {
  // The dialog is open, so the current path is the tab's own: deleting closes and reloads like a save.
  const { saved } = useSettingsDialog(usePathname());
  // null: closed. "ask": the delete confirmation. A string: the API's reason the record can't be deleted.
  const [step, setStep] = useState<null | "ask" | { inUse: string }>(null);
  const { name, noun } = record;

  function done(message: string) {
    setStep(null);
    saved(message);
  }
  async function send(request: () => Promise<unknown>, success: string) {
    try {
      await request();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return done(DELETE_TEXT.alreadyDeleted(noun));
      // The API's message ends "Deactivate it instead.", which the in-use step offers as its button.
      if (error instanceof ApiError && error.status === 409 && error.code === "in_use")
        return setStep({ inUse: error.message.replace(/\s*Deactivate it instead\.$/, "") });
      handleApiError(error);
      return;
    }
    done(success);
  }

  const inUse = step !== null && step !== "ask" ? step.inUse : null;
  const ask =
    inUse === null
      ? {
          tone: "danger" as const,
          title: `Delete ${noun}?`,
          description: (
            <p>
              Are you sure you want to delete <strong className="text-foreground">{name}</strong>? This can&apos;t be undone. If the {noun} is
              already used on any record, it can&apos;t be deleted.
            </p>
          ),
          confirmLabel: `Delete ${noun}`,
          pendingLabel: "Deleting…",
          onConfirm: () => send(() => apiClient.delete(record.path), DELETE_TEXT.deleted(noun)),
        }
      : record.active
        ? {
            title: `Deactivate ${noun} instead?`,
            description: (
              <>
                <p>{inUse}</p>
                <p>{record.deactivateNote}</p>
              </>
            ),
            confirmLabel: `Deactivate ${noun}`,
            pendingLabel: "Deactivating…",
            onConfirm: () => send(() => apiClient.patch(record.path, { status: "Inactive" }), DELETE_TEXT.deactivated(noun)),
          }
        : {
            title: `Can't delete ${noun}`,
            description: (
              <>
                <p>{inUse}</p>
                <p>{DELETE_TEXT.alreadyInactive}</p>
              </>
            ),
          };

  return (
    <>
      <Button type="button" variant="destructive" className={cn(footerButtonClass, "sm:mr-auto")} onClick={() => setStep("ask")} disabled={disabled}>
        Delete
      </Button>
      <ConfirmDialog open={step !== null} onCancel={() => setStep(null)} {...ask} />
    </>
  );
}

/**
 * A failed save: the API's field errors go under their fields, the first one focused, values kept (E1-E3); anything
 * else toasts (handleApiError). Every field the API can name must be on the form.
 */
export function setApiErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>) {
  Object.entries(handleApiError(error) ?? {}).forEach(([field, message], index) =>
    setError(field as Path<T>, { message }, { shouldFocus: index === 0 }),
  );
}

/**
 * The confirmation before a Settings record is deleted or deactivated: an alertdialog over the edit dialog. `danger`
 * is for what can't be undone (Delete: red icon, solid red button), `warning` for what can (Deactivate: amber icon,
 * the soft red button) or only informs (leave out `confirmLabel`: its one button is Close). Focus starts on Cancel, so
 * Enter never confirms by accident, and returns to the button that opened it on close. While `onConfirm` runs, the
 * button shows `pendingLabel` with a spinner and nothing can close or confirm again; the caller closes the dialog
 * (onCancel or `open`) when it is done.
 */
export function ConfirmDialog({
  open,
  tone = "warning",
  title,
  description,
  confirmLabel,
  pendingLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  tone?: "danger" | "warning";
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  // A second click can land before the render that disables the button; this stops it sending twice.
  const running = useRef(false);
  async function confirm() {
    if (running.current || !onConfirm) return;
    running.current = true;
    setPending(true);
    try {
      await onConfirm();
    } finally {
      running.current = false;
      setPending(false);
    }
  }

  // A new step while open (the API said the record is in use) puts focus back on Cancel, so a repeated Enter can't
  // confirm something the user hasn't read yet.
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) cancel.current?.focus();
  }, [open, title]);
  // Radix returns focus to a DialogTrigger, and these open from a button's handler instead, so remember that button.
  const opener = useRef<HTMLElement | null>(null);

  const Icon = tone === "danger" ? TriangleAlertIcon : CircleAlertIcon;
  return (
    <Dialog open={open} onOpenChange={(next) => (next || pending ? undefined : onCancel())}>
      <DialogContent
        role="alertdialog"
        showCloseButton={false}
        className="gap-0 pb-[26px] sm:max-w-[460px]"
        onOpenAutoFocus={() => {
          opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          opener.current?.focus();
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row">
          <span
            aria-hidden
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              tone === "danger" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning",
            )}
          >
            <Icon className="size-5" />
          </span>
          <DialogHeader className="min-w-0 gap-[7px]">
            <DialogTitle className="text-[21px] leading-[26px]">{title}</DialogTitle>
            {/* The class goes on DialogDescription, which merges it over its 15 px default; asChild alone would not. */}
            <DialogDescription asChild className="flex flex-col gap-2 text-sm leading-5 [overflow-wrap:anywhere]">
              <div>{description}</div>
            </DialogDescription>
          </DialogHeader>
        </div>
        <DialogFooter className="mt-5 pt-4">
          <Button ref={cancel} type="button" variant="outline" className={cn(footerButtonClass, "border-input")} onClick={onCancel} disabled={pending}>
            {confirmLabel ? "Cancel" : "Close"}
          </Button>
          {confirmLabel ? (
            <Button
              type="button"
              variant={tone === "danger" ? "default" : "destructive"}
              className={cn(footerButtonClass, tone === "danger" && "bg-destructive text-white hover:bg-danger", pending && "disabled:opacity-100")}
              onClick={confirm}
              disabled={pending}
              aria-busy={pending}
            >
              {pending ? (
                <>
                  <Spinner aria-hidden />
                  {pendingLabel ?? confirmLabel}
                </>
              ) : (
                confirmLabel
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Deactivate supplier?" before a save sets an Active record Inactive; `note` says what that changes. */
export function DeactivateConfirm({
  open,
  name,
  noun,
  note,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  name: string;
  noun: string;
  note: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      title={`Deactivate ${noun}?`}
      description={
        <p>
          Are you sure you want to deactivate <strong className="text-foreground">{name}</strong>? {note}
        </p>
      }
      confirmLabel={`Deactivate ${noun}`}
      pendingLabel="Deactivating…"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
