"use client";

import { CircleAlertIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

// The confirmation before a record is deleted, deactivated or removed (Settings, Orders, Users). Orchestrator-owned:
// features pass their own wording and never copy this. Sized like the Settings dialogs: 21 px title, 14 px description,
// 42 px footer buttons.

/** The 42 px footer button size of the Settings dialogs and these confirmations. */
export const dialogFooterButtonClass = "h-[42px] px-[17px]";

/**
 * An alertdialog over the screen or dialog that opened it. `danger` is for what can't be undone (Delete: red icon,
 * solid red button), `warning` for what can (Deactivate: amber icon, the soft red button) or only informs (leave out
 * `confirmLabel`: its one button is Close). Focus starts on Cancel, so Enter never confirms by accident, and returns to
 * the button that opened it on close. While `onConfirm` runs, the button shows `pendingLabel` with a spinner and nothing
 * can close or confirm again; the caller closes the dialog (onCancel or `open`) when it is done.
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
          <Button ref={cancel} type="button" variant="outline" className={cn(dialogFooterButtonClass, "border-input")} onClick={onCancel} disabled={pending}>
            {confirmLabel ? "Cancel" : "Close"}
          </Button>
          {confirmLabel ? (
            <Button
              type="button"
              variant={tone === "danger" ? "default" : "destructive"}
              className={cn(dialogFooterButtonClass, tone === "danger" && "bg-destructive text-white hover:bg-danger", pending && "disabled:opacity-100")}
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

/** "Deactivate supplier?" before a record is set Inactive: names the record; `note` says what that changes. */
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
