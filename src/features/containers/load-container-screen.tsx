"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { differenceInCalendarDays, parseISO } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/cards";
import { FormFooter, NativeSelect, RequiredMark } from "@/components/shared/form";
import { KeyValueList } from "@/components/shared/key-value-list";
import { ProgressBar } from "@/components/shared/progress";
import { Journey } from "@/components/shared/timeline";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api/client";
import { handleApiError, notifySuccess } from "@/lib/feedback";
import { formatNumber, formatQty, formatShortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Terms } from "@/types/domain";

import {
  contents,
  LOAD_FIELDS,
  lineLoads,
  loadContainerSchema,
  parseCount,
  toContainerBody,
  toLoadValues,
  type LoadContainerValues,
} from "./containers-logic";
import type { LoadContainerData } from "./data/queries";

// Proposed wording: SUCCESS has no container message yet.
const CONTAINER_SAVED = "Container saved";

// Measured from 23_8_Container_loading_-_Stage_3_form.jpeg: 12.5 px bold labels 5 px above 42 px fields, 12 px
// table headers in a 30 px row, 60 px item rows. Cards use titleGap="none" and place their content where the
// reference has it.
const fieldClass = "gap-[5px]";
const labelClass = "gap-0.5 text-[12.5px] leading-[15px] font-bold text-label";
const headClass = "h-[30px] px-1.5 text-[12px] font-bold text-table-head-foreground";
const cellClass = "px-1.5 py-0";
const lineInputClass = "h-[38px] pr-2.5 text-right text-sm font-bold text-label";

const TERMS: Terms[] = ["FOB", "CNF"];

const shortDate = (value: string) => (value ? formatShortDate(value) : "–");

/**
 * Load container, Stage 3 (23_8_Container_loading_-_Stage_3_form.jpeg). CON-2's loadable lines are listed with an
 * empty quantity (not loaded); Save posts CON-3 with the lines that have one, then goes to /containers.
 */
export function LoadContainerScreen({ agents, lines: loadable, today }: LoadContainerData) {
  const router = useRouter();
  const { register, control, handleSubmit, reset, setError, formState } = useForm<LoadContainerValues>({
    resolver: zodResolver(loadContainerSchema),
    defaultValues: toLoadValues(loadable, today),
  });
  const { errors, isSubmitting } = formState;
  const [agentId, loadedOn, sailedOn, eta, values] = useWatch({
    control,
    name: ["shippingAgentId", "loadedOn", "sailedOn", "eta", "lines"],
  });
  const lines = values.map((line) => ({ ...line, bundles: parseCount(line.bundles), quantity: parseCount(line.quantity) }));
  const glance = contents(lines);
  const loads = lineLoads(lines);
  const departs = sailedOn || loadedOn;
  const seaDays = departs && eta ? differenceInCalendarDays(parseISO(eta), parseISO(departs)) : null;
  const agent = agents.find((a) => a.id === agentId)?.name;
  const linesError = errors.lines?.root?.message ?? errors.lines?.message;

  const onSubmit = handleSubmit(async (form) => {
    try {
      await apiClient.post<{ container: { id: string } }>("/containers", toContainerBody(form));
    } catch (error) {
      const fields = handleApiError(error) ?? {};
      LOAD_FIELDS.filter((key) => fields[key]).forEach((key, index) =>
        setError(key, { type: "server", message: fields[key] }, { shouldFocus: index === 0 }),
      );
      return;
    }
    notifySuccess(CONTAINER_SAVED);
    // The page stays mounted (Activity), so the next visit starts from an empty form.
    reset();
    router.push("/containers");
    router.refresh();
  });

  return (
    <>
      <PageHeader
        title="Load container"
        parent={{ label: "Containers", href: "/containers" }}
        actions={
          <Button asChild variant="outline">
            <Link href="/containers" onClick={() => reset()}>
              Cancel
            </Link>
          </Button>
        }
      />
      <PageContainer>
        <div className="grid items-start gap-(--page-gap) lg:grid-cols-[minmax(0,1fr)_400px]">
          <form noValidate className="flex min-w-0 flex-col gap-(--page-gap)" onSubmit={onSubmit}>
            <SectionCard title="Container details" titleGap="none">
              <FieldGroup className="mt-3 grid gap-x-4 gap-y-[14px] sm:grid-cols-3">
                <Field className={fieldClass} data-invalid={!!errors.number}>
                  <FieldLabel htmlFor="container-number" className={labelClass}>
                    Container number <RequiredMark />
                  </FieldLabel>
                  <Input size="sm" id="container-number" required autoComplete="off" aria-invalid={!!errors.number} {...register("number")} />
                  <FieldError errors={[errors.number]} />
                </Field>
                <Field className={fieldClass} data-invalid={!!errors.shippingAgentId}>
                  <FieldLabel htmlFor="shipping-agent" className={labelClass}>
                    Shipping agent <RequiredMark />
                  </FieldLabel>
                  <NativeSelect size="sm" id="shipping-agent" required aria-invalid={!!errors.shippingAgentId} {...register("shippingAgentId")}>
                    <option value="" />
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </NativeSelect>
                  <FieldError errors={[errors.shippingAgentId]} />
                </Field>
                <Field className={fieldClass} data-invalid={!!errors.terms}>
                  <FieldLabel htmlFor="container-terms" className={labelClass}>
                    Container terms <RequiredMark />
                  </FieldLabel>
                  <NativeSelect size="sm" id="container-terms" required aria-invalid={!!errors.terms} {...register("terms")}>
                    {TERMS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </NativeSelect>
                  <FieldError errors={[errors.terms]} />
                </Field>
                <Field className={fieldClass} data-invalid={!!errors.loadedOn}>
                  <FieldLabel htmlFor="loaded-on" className={labelClass}>
                    Loaded on
                  </FieldLabel>
                  <Input size="sm" id="loaded-on" type="date" aria-invalid={!!errors.loadedOn} {...register("loadedOn")} />
                  <FieldError errors={[errors.loadedOn]} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="etd" className={labelClass}>
                    Expected departure (ETD)
                  </FieldLabel>
                  <Input size="sm" id="etd" type="date" {...register("sailedOn")} />
                </Field>
                <Field className={fieldClass} data-invalid={!!errors.eta}>
                  <FieldLabel htmlFor="eta" className={labelClass}>
                    Expected arrival in India (ETA)
                  </FieldLabel>
                  <Input size="sm" id="eta" type="date" aria-invalid={!!errors.eta} {...register("eta")} />
                  <FieldError errors={[errors.eta]} />
                </Field>
                <Field className={cn(fieldClass, "sm:col-span-2")}>
                  <FieldLabel htmlFor="port-of-loading" className={labelClass}>
                    Port of loading
                  </FieldLabel>
                  <Input size="sm" id="port-of-loading" {...register("portOfLoading")} />
                </Field>
                <Field className={fieldClass}>
                  <FieldLabel htmlFor="port-of-arrival" className={labelClass}>
                    Port of arrival
                  </FieldLabel>
                  <Input size="sm" id="port-of-arrival" {...register("portOfArrival")} />
                </Field>
              </FieldGroup>
            </SectionCard>

            <SectionCard title="What is loaded in this container" titleGap="none">
              <Table className="mt-3">
                <TableHeader>
                  <TableRow className="bg-table-head hover:bg-table-head">
                    <TableHead className={cn(headClass, "w-[81px]")}>PO</TableHead>
                    <TableHead className={headClass}>Item</TableHead>
                    <TableHead className={cn(headClass, "w-[103px] text-right")}>Bundles</TableHead>
                    <TableHead className={cn(headClass, "w-[167px] text-right")}>Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow className="h-[60px] hover:bg-transparent">
                      <TableCell colSpan={4} className={cn(cellClass, "text-center text-muted-foreground")}>
                        Nothing received is waiting to be loaded.
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {lines.map((line, i) => {
                    const name = `${line.po} ${line.item}`;
                    const quantityError = errors.lines?.[i]?.quantity;
                    return (
                      <TableRow key={line.orderLineId} className="h-[60px] border-border-subtle hover:bg-transparent">
                        <TableCell className={cn(cellClass, "font-bold")}>{line.po}</TableCell>
                        <TableCell className={cellClass}>
                          {line.item}
                          <span className="block text-[12px] leading-4 text-muted-foreground">
                            {formatQty(line.received, line.unit)} received · {formatNumber(line.loaded)} loaded
                          </span>
                        </TableCell>
                        {/* The reference sets the inputs 8 px from the row top, above the text line. */}
                        <TableCell className={cn(cellClass, "pt-2 text-right align-top")}>
                          <Input
                            aria-label={`Bundles, ${name}`}
                            inputMode="numeric"
                            autoComplete="off"
                            {...register(`lines.${i}.bundles`)}
                            className={cn(lineInputClass, "w-[91px]")}
                          />
                        </TableCell>
                        <TableCell className={cn(cellClass, "pt-2 pb-1 text-right align-top")}>
                          <Input
                            aria-label={`Quantity, ${name}`}
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder={line.unit}
                            aria-invalid={!!quantityError}
                            {...register(`lines.${i}.quantity`)}
                            className={cn(lineInputClass, "ml-auto w-[155px]")}
                          />
                          <FieldError className="mt-1 text-[12px]" errors={[quantityError]} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <FieldError className="mt-2" errors={linesError ? [{ message: linesError }] : []} />

              <p className="mt-[11px] rounded-[10px] border bg-table-head px-3.5 py-[10.5px] text-[13px] leading-5 text-label">
                <strong>FOB</strong>: we pay the freight from the China port. <strong>CNF</strong>: the supplier pays the freight
                up to India.
              </p>

              <FormFooter className="mt-[17px] gap-3">
                <Button type="submit" size="lg" className="w-[210px] min-w-0 text-[15px]" disabled={isSubmitting}>
                  Save container
                </Button>
              </FormFooter>
            </SectionCard>
          </form>

          <div className="flex flex-col gap-(--page-gap)">
            <SectionCard title="Journey" titleGap="none">
              <Journey
                size="sm"
                align="edges"
                className="mt-3"
                steps={[
                  { title: shortDate(loadedOn), lines: ["Loaded"], marker: "dot" },
                  { title: shortDate(sailedOn), lines: ["Departs"], marker: "ring" },
                  { title: shortDate(eta), lines: ["Arrives"], marker: "ring" },
                ]}
              />
              <p className="mt-2 text-sm leading-5 text-label">
                {seaDays !== null ? `About ${seaDays} days at sea. ` : ""}Agent: {agent ?? "–"}.
              </p>
            </SectionCard>

            <SectionCard title="Contents at a glance" titleGap="none" aria-label="Contents at a glance">
              <KeyValueList
                boldValues
                className="mt-[10px]"
                items={[
                  { label: "Orders in this container", value: glance.orders },
                  { label: "Item lines", value: glance.lines },
                  { label: "Total bundles", value: formatNumber(glance.bundles) },
                ]}
              />
            </SectionCard>

            <SectionCard title="Where each order is loaded" titleGap="none">
              <ul className="mt-3">
                {loads.length === 0 ? <li className="text-sm leading-5 text-muted-foreground">Nothing loaded yet.</li> : null}
                {loads.map((load) => (
                  <li key={load.orderLineId} className="border-b border-border-subtle py-2.5 last:border-b-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-sm leading-5 font-bold">{load.title}</span>
                      <span className="text-[12.5px] leading-[18px] whitespace-nowrap text-muted-foreground">
                        {formatNumber(load.loaded)} of {formatNumber(load.received)}
                      </span>
                    </div>
                    <ProgressBar size="sm" value={load.loaded} max={load.received} label={`${load.title} loaded`} className="mt-[7px]" />
                    <p className="mt-[7px] text-[12.5px] leading-[17.5px] text-muted-foreground">
                      {load.rest > 0 ? `Rest, ${formatQty(load.rest, load.unit)}, goes in the next container` : "Everything received is loaded"}
                    </p>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
