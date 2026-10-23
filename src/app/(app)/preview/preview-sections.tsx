"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";

import { DataTable } from "@/components/shared/data-table";
import { FilterChips, FilterSelect, SearchInput } from "@/components/shared/filters";
import { FormFooter, NativeSelect, RequiredMark } from "@/components/shared/form";
import { StageProgress } from "@/components/shared/progress";
import { notInPrototype } from "@/components/shared/prototype";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatINR, formatQty, formatShortDate } from "@/lib/formatters";

import type { PreviewDelivery, PreviewOrder } from "./preview-data";

export function HeaderActions() {
  const [query, setQuery] = useState("");
  return (
    <>
      <SearchInput label="Search" placeholder="Search PO, supplier, container" value={query} onValueChange={setQuery} className="h-[38px] w-[250px]" />
      <Button variant="outline" onClick={() => notInPrototype("Print order")}>
        Print order
      </Button>
    </>
  );
}

const deliveryColumns: ColumnDef<PreviewDelivery>[] = [
  { accessorKey: "po", header: "PO" },
  { accessorKey: "supplier", header: "Supplier" },
  { accessorKey: "due", header: "Due date", cell: ({ row }) => formatShortDate(row.original.due) },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusPill tone={row.original.tone}>{row.original.status}</StatusPill> },
];

export function DeliveriesTable({ rows }: { rows: PreviewDelivery[] }) {
  return <DataTable columns={deliveryColumns} data={rows} getRowId={(r) => r.po} density="compact" variant="plain" />;
}

const orderColumns: ColumnDef<PreviewOrder>[] = [
  { accessorKey: "po", header: "PO", cell: ({ row }) => <span className="font-bold">{row.original.po}</span>, footer: "Total" },
  { accessorKey: "item", header: "Item" },
  { accessorKey: "supplier", header: "Supplier" },
  { accessorKey: "qty", header: "Quantity", cell: ({ row }) => formatQty(row.original.qty, row.original.unit) },
  { accessorKey: "stage", header: "Stage", cell: ({ row }) => <StageProgress stage={row.original.stage} /> },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusPill tone={row.original.tone}>{row.original.status}</StatusPill> },
  {
    accessorKey: "paidInr",
    header: "Paid so far (INR)",
    meta: { align: "right" },
    cell: ({ row }) => formatINR(row.original.paidInr),
    footer: ({ table }) => formatINR(table.getCoreRowModel().rows.reduce((sum, r) => sum + r.original.paidInr, 0)),
  },
];

const CHIPS = [
  { value: "all", label: "All 50" },
  { value: "late", label: "Late 3", tone: "danger" as const },
  { value: "soon", label: "Due soon 5" },
  { value: "completed", label: "Completed" },
];

export function OrdersPreview({ rows }: { rows: PreviewOrder[] }) {
  const [chip, setChip] = useState("all");
  const [stage, setStage] = useState("all");
  const [selected, setSelected] = useState("PO-2028");
  const [query, setQuery] = useState("");
  return (
    <div className="flex flex-col gap-(--page-gap)">
      <div className="flex flex-wrap items-center gap-4">
        <SearchInput label="Search orders" placeholder="Search PO, item or supplier" value={query} onValueChange={setQuery} className="w-[290px]" />
        <FilterSelect
          label="Stage"
          showLabel
          value={stage}
          onValueChange={setStage}
          options={[{ value: "all", label: "All stages" }, { value: "1", label: "1. Order and deposit" }]}
        />
        <FilterChips label="Order status" options={CHIPS} value={chip} onValueChange={setChip} className="ml-auto" />
      </div>
      <DataTable
        columns={orderColumns}
        data={rows}
        getRowId={(r) => r.po}
        density="tall"
        selectedRowId={selected}
        onRowClick={(r) => setSelected(r.po)}
        pagination={{ pageSize: 5, rowCount: 50, itemLabel: "orders", onPageChange: () => notInPrototype("Other pages") }}
      />
    </div>
  );
}

export function FormKitPreview() {
  return (
    <form noValidate onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-6">
      <FieldGroup className="grid gap-x-4 gap-y-[22px] sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="pv-po">Purchase order no.</FieldLabel>
          <Input id="pv-po" defaultValue="PO-2050" />
        </Field>
        <Field>
          <FieldLabel htmlFor="pv-received">Received on (read-only)</FieldLabel>
          <Input id="pv-received" defaultValue="26 Aug 2026" readOnly />
        </Field>
        <Field>
          <FieldLabel htmlFor="pv-duty">Duty paid on</FieldLabel>
          <Input id="pv-duty" placeholder="Select date" className="border-dashed" />
        </Field>
        <Field>
          <FieldLabel htmlFor="pv-supplier">
            Supplier <RequiredMark />
          </FieldLabel>
          <NativeSelect id="pv-supplier" required defaultValue="Foshan Fabrics">
            <option>Foshan Fabrics</option>
            <option>Guangzhou Textile Co.</option>
          </NativeSelect>
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="pv-remark">Short remark</FieldLabel>
          <Textarea id="pv-remark" defaultValue="40 jackets not delivered. Reduce the payment for these 40 pieces." />
        </Field>
      </FieldGroup>
      <div className="flex flex-wrap items-center gap-8">
        <div className="flex items-center gap-3">
          <Checkbox id="pv-stage" defaultChecked />
          <Label htmlFor="pv-stage" className="text-[15px] font-normal">
            Receiving (China)
          </Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch id="pv-toggle" defaultChecked />
          <Label htmlFor="pv-toggle" className="text-[15px] font-normal">
            Delivery reminders
          </Label>
        </div>
      </div>
      <FormFooter>
        <Button type="button" variant="outline" size="lg" onClick={() => notInPrototype("Save draft")}>
          Save draft
        </Button>
        <Button type="button" size="lg" onClick={() => notInPrototype("Place order")}>
          Place order
        </Button>
      </FormFooter>
    </form>
  );
}

export function DialogPreview() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>+ Add supplier</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add supplier</DialogTitle>
          <DialogDescription>Add a new supplier so you can pick it on an order.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="pv-dialog-name">
            Supplier name <RequiredMark />
          </FieldLabel>
          <Input id="pv-dialog-name" defaultValue="Ningbo Denim Works" />
        </Field>
        <DialogFooter>
          <Button variant="outline" size="lg" className="min-w-0 px-6">
            Cancel
          </Button>
          <Button size="lg" className="min-w-0 px-6" onClick={() => notInPrototype("Save supplier")}>
            Save supplier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
