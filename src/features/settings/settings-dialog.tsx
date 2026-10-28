"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { handleApiError, notifySuccess } from "@/lib/feedback";
import { cn } from "@/lib/utils";

// The Settings add/edit dialogs (tabs 1-7) and the deactivate confirmation. Coordinator-owned; the tabs build their
// forms on it. Measured from 53_17.4_Add_supplier_(pop-up).jpeg: 21 px title over a 14 px description, 12.5 px bold
// labels 5 px above 42 px fields with 14 px text, 14 px between rows, 42 px footer buttons.

export const fieldClass = "gap-[5px]";
export const labelClass = "gap-0.5 text-[12.5px] leading-[15px] font-bold text-label";
export const footerButtonClass = "h-[42px] px-[17px]";

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
  const close = () => router.replace(path, { scroll: false });
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
 * dialog itself takes focus. Content unmounts on close, so a form inside opens from its defaults every time.
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
          <DialogTitle className="text-[21px] leading-[19px]">{title}</DialogTitle>
          <DialogDescription className="text-sm leading-5">{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** Cancel and the submit button, disabled while the request runs (E14: no spinner is designed). */
export function SettingsDialogFooter({ onCancel, submitLabel, submitting }: { onCancel: () => void; submitLabel: string; submitting: boolean }) {
  return (
    <DialogFooter className="mt-5 pt-4">
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
 * A failed save: the API's field errors go under their fields, the first one focused, values kept (E1-E3); anything
 * else toasts (handleApiError). Every field the API can name must be on the form.
 */
export function setApiErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>) {
  Object.entries(handleApiError(error) ?? {}).forEach(([field, message], index) =>
    setError(field as Path<T>, { message }, { shouldFocus: index === 0 }),
  );
}

/**
 * "Are you sure?" before deactivating a record. Confirm stays disabled while `onConfirm` runs; the caller closes
 * the dialog (onCancel or by changing `open`) when it is done.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  async function confirm() {
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next || pending ? undefined : onCancel())}>
      <DialogContent showCloseButton={false} className="gap-0 pb-[26px] sm:max-w-[440px]">
        <DialogHeader className="gap-[7px]">
          <DialogTitle className="text-[21px] leading-[19px]">{title}</DialogTitle>
          <DialogDescription className="text-sm leading-5">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-5 pt-4">
          <Button type="button" variant="outline" className={cn(footerButtonClass, "border-input")} onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" variant={destructive ? "destructive" : "default"} className={footerButtonClass} onClick={confirm} disabled={pending}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
