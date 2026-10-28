"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/cards";
import { DataTable } from "@/components/shared/data-table";
import { KeyValueList } from "@/components/shared/key-value-list";
import { PoLink } from "@/components/shared/po-link";
import { StatusPill, TermsBadge } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { ContainerDetail, UpdateContainerResponse } from "@/lib/api/types";
import { handleApiError, notifyError, notifySuccess } from "@/lib/feedback";
import { formatDate, formatNumber, formatQty } from "@/lib/formatters";

import {
  ACTION_LABEL,
  actionFields,
  CONTAINER_STATUS,
  containerActions,
  containerDatesSchema,
  toUpdateBody,
  type ContainerAction,
  type ContainerDatesValues,
} from "./containers-logic";
import type { ContainerDetailData } from "./data/queries";

// No reference design: built from the shell, cards, key-value list, DataTable and the Add supplier dialog pattern.
// Proposed wording throughout (no approved messages exist for container status changes).

const DESCRIPTION: Record<ContainerAction, string> = {
  sail: `Enter the date it sailed. The status changes to ${CONTAINER_STATUS.sea.label}.`,
  arrive: `The status changes to ${CONTAINER_STATUS.arrived.label}. After this, the container can't be changed.`,
  eta: "Correct the expected arrival in India.",
  dates: "Correct the sailing date or the expected arrival in India.",
};
const SUBMIT: Record<ContainerAction, string> = { sail: "Mark as sailed", arrive: "Mark as arrived", eta: "Save ETA", dates: "Save dates" };
const SAVED: Record<ContainerAction, string> = {
  sail: "Container marked as sailed",
  arrive: "Container marked as arrived",
  eta: "ETA saved",
  dates: "Dates saved",
};

const date = (value: string | null) => (value ? formatDate(value) : "–");
const fieldClass = "gap-[5px]";
const labelClass = "gap-0.5 text-[12.5px] leading-[15px] font-bold text-label";

type Line = ContainerDetail["lines"][number];
const columnsFor = (linkPos: boolean): ColumnDef<Line>[] => [
  { id: "po", header: "PO", meta: { className: "w-[110px]" }, cell: ({ row }) => <PoLink po={row.original.po} linked={linkPos} /> },
  { accessorKey: "item", header: "Item" },
  { id: "bundles", header: "Bundles", meta: { align: "right", className: "w-[100px]" }, cell: ({ row }) => formatNumber(row.original.bundles) },
  {
    id: "quantity",
    header: "Quantity",
    meta: { align: "right", className: "w-[140px]" },
    cell: ({ row }) => formatQty(row.original.quantity, row.original.unit),
  },
];

/** Container detail (CON-4) with the status and date actions (CON-5) for users who can enter containers. */
export function ContainerDetailScreen({ data }: { data: ContainerDetailData }) {
  const { container, today, canEnter, linkPos } = data;
  const router = useRouter();
  const columns = useMemo(() => columnsFor(linkPos), [linkPos]);
  const actions = canEnter ? containerActions(container.status) : [];
  const status = CONTAINER_STATUS[container.status];
  const [dialog, setDialog] = useState<{ action: ContainerAction; open: boolean }>({ action: "sail", open: false });
  const close = () => setDialog((current) => ({ ...current, open: false }));
  // The page stays mounted when hidden (Activity): don't come back to a dialog left open.
  useLayoutEffect(() => () => setDialog((current) => ({ ...current, open: false })), []);

  const actionButtons = actions.map((action, index) => (
    <Button key={action} size="header" variant={index === 0 ? "default" : "outline"} onClick={() => setDialog({ action, open: true })}>
      {ACTION_LABEL[action]}
    </Button>
  ));

  return (
    <>
      <PageHeader
        title={container.number}
        parent={{ label: "Containers", href: "/containers" }}
        titleAddon={<StatusPill tone={status.tone}>{status.label}</StatusPill>}
        // Below md the title would shrink to nothing beside two buttons, so the buttons move under the header.
        actions={actions.length ? <div className="hidden items-center gap-3.5 md:flex">{actionButtons}</div> : undefined}
      />
      <PageContainer>
        {actions.length ? <div className="flex flex-wrap items-center gap-3 md:hidden">{actionButtons}</div> : null}
        <div className="grid items-start gap-(--page-gap) lg:grid-cols-[minmax(0,1fr)_400px]">
          <SectionCard title="What is loaded" titleGap="none" bottomGap="tight" className="min-w-0">
            <DataTable
              columns={columns}
              data={container.lines}
              getRowId={(line) => line.orderLineId}
              variant="plain"
              density="snug"
              className="mt-3"
              emptyState="Nothing is loaded in this container."
            />
          </SectionCard>
          <SectionCard title="Container details" titleGap="none">
            <KeyValueList
              boldValues
              className="mt-[10px]"
              items={[
                { label: "Status", value: <StatusPill tone={status.tone}>{status.label}</StatusPill> },
                { label: "Shipping agent", value: container.agent.name },
                { label: "Terms", value: <TermsBadge terms={container.terms} /> },
                { label: "Port of loading", value: container.portOfLoading || "–" },
                { label: "Port of arrival", value: container.portOfArrival || "–" },
                { label: "Loaded on", value: date(container.loadedOn) },
                { label: "Sailed on", value: date(container.sailedOn) },
                { label: "ETA India", value: `${container.etaEstimated ? "Est. " : ""}${date(container.eta)}` },
                { label: "Bundles", value: formatNumber(container.bundles) },
              ]}
            />
            {container.status === "arrived" ? (
              <p className="mt-2 text-sm leading-5 text-muted-foreground">This container has arrived and can&apos;t be changed.</p>
            ) : null}
          </SectionCard>
        </div>
      </PageContainer>

      {canEnter ? (
        <Dialog open={dialog.open} onOpenChange={(open) => (open ? undefined : close())}>
          <DialogContent className="gap-0 pb-[26px]">
            <DialogHeader className="gap-[7px]">
              <DialogTitle className="text-[21px] leading-[26px]">{ACTION_LABEL[dialog.action]}</DialogTitle>
              <DialogDescription className="text-sm leading-5">{DESCRIPTION[dialog.action]}</DialogDescription>
            </DialogHeader>
            {/* DialogContent unmounts on close, so every opening starts from the saved dates. */}
            <ContainerActionForm
              key={dialog.action}
              action={dialog.action}
              container={container}
              today={today}
              onCancel={close}
              onStale={() => {
                // 409: another user already changed this container, so this page is out of date. Show the real state.
                close();
                router.refresh();
              }}
              onSaved={() => {
                notifySuccess(SAVED[dialog.action]);
                close();
                router.refresh();
              }}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

function ContainerActionForm({
  action,
  container,
  today,
  onCancel,
  onStale,
  onSaved,
}: {
  action: ContainerAction;
  container: ContainerDetail;
  today: string;
  onCancel: () => void;
  onStale: () => void;
  onSaved: () => void;
}) {
  const fields = actionFields(action);
  const { register, handleSubmit, setError, formState } = useForm<ContainerDatesValues>({
    resolver: zodResolver(containerDatesSchema(action, container, today)),
    defaultValues: { sailedOn: container.sailedOn ?? "", eta: container.eta },
  });
  const { errors, isSubmitting } = formState;

  const save = handleSubmit(async (values) => {
    const body = toUpdateBody(action, values, container);
    if (Object.keys(body).length === 0) {
      onCancel(); // Nothing changed.
      return;
    }
    try {
      await apiClient.patch<UpdateContainerResponse>(`/containers/${container.id}`, body);
    } catch (error) {
      const stale = error instanceof ApiError && error.status === 409 && !error.fields;
      // 409 container_arrived / invalid_status_change (no fields) are toasted by handleApiError; field messages go
      // under their field, or into a toast when this dialog has no such field.
      Object.entries(handleApiError(error) ?? {}).forEach(([key, message], index) => {
        const field = fields.find((name) => name === key);
        if (field) setError(field, { type: "server", message }, { shouldFocus: index === 0 });
        else notifyError(message);
      });
      if (stale) onStale();
      return;
    }
    onSaved();
  });

  return (
    <form noValidate onSubmit={save} className="mt-[14px]">
      {fields.length ? (
        <div className="grid gap-x-4 gap-y-[14px] sm:grid-cols-2">
          {fields.includes("sailedOn") ? (
            <Field className={fieldClass} data-invalid={!!errors.sailedOn}>
              <FieldLabel htmlFor="container-sailed-on" className={labelClass}>
                Sailing date
              </FieldLabel>
              <Input
                id="container-sailed-on"
                type="date"
                size="sm"
                min={container.loadedOn ?? undefined}
                max={today}
                aria-invalid={!!errors.sailedOn}
                {...register("sailedOn")}
              />
              <FieldError errors={[errors.sailedOn]} />
            </Field>
          ) : null}
          <Field className={fieldClass} data-invalid={!!errors.eta}>
            <FieldLabel htmlFor="container-eta" className={labelClass}>
              Expected arrival in India (ETA)
            </FieldLabel>
            <Input id="container-eta" type="date" size="sm" aria-invalid={!!errors.eta} {...register("eta")} />
            <FieldError errors={[errors.eta]} />
          </Field>
        </div>
      ) : null}
      <DialogFooter className="mt-5 pt-4">
        <Button type="button" variant="outline" className="h-[42px] border-input px-[17px]" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="h-[42px] px-[17px]" disabled={isSubmitting}>
          {SUBMIT[action]}
        </Button>
      </DialogFooter>
    </form>
  );
}
