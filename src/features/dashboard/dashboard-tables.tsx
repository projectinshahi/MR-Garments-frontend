"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";

import { DataTable } from "@/components/shared/data-table";
import { ErrorState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { formatCNY, formatShortDate } from "@/lib/formatters";

import type { ContainerRow, DeliveryRow, PaymentDueRow } from "./dashboard-logic";

// Column widths put each column where 04_2_Dashboard.jpeg has it; the last column takes the rest.

const deliveryColumns: ColumnDef<DeliveryRow>[] = [
  { accessorKey: "po", header: "PO", meta: { className: "w-[88px]" } },
  { accessorKey: "supplier", header: "Supplier", meta: { className: "w-[203px]" } },
  { accessorKey: "due", header: "Due date", meta: { className: "w-[86px]" }, cell: ({ row }) => formatShortDate(row.original.due) },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusPill tone={row.original.tone}>{row.original.status}</StatusPill>,
  },
];

// "Payee" rather than the reference's "Supplier": a payment can be due to a shipping agent.
const paymentColumns: ColumnDef<PaymentDueRow>[] = [
  { accessorKey: "payee", header: "Payee", meta: { className: "w-[183px]" } },
  { accessorKey: "po", header: "PO", meta: { className: "w-[82px]" } },
  { accessorKey: "payment", header: "Payment", meta: { className: "w-[77px]" } },
  { accessorKey: "due", header: "Due", meta: { className: "w-[80px]" }, cell: ({ row }) => formatShortDate(row.original.due) },
  { accessorKey: "amountCny", header: "Amount (CNY)", meta: { align: "right" }, cell: ({ row }) => formatCNY(row.original.amountCny) },
];

const containerColumns: ColumnDef<ContainerRow>[] = [
  { accessorKey: "container", header: "Container", meta: { className: "w-[173px]" } },
  { accessorKey: "agent", header: "Agent", meta: { className: "w-[157px]" } },
  { accessorKey: "terms", header: "Terms", meta: { className: "w-[77px]" } },
  { accessorKey: "etaIndia", header: "ETA India", cell: ({ row }) => formatShortDate(row.original.etaIndia) },
];

const empty = (text: string) => <span className="text-muted-foreground">{text}</span>;

export function DeliveriesTable({ rows }: { rows: DeliveryRow[] }) {
  return (
    <DataTable
      columns={deliveryColumns}
      data={rows}
      getRowId={(r) => r.po}
      density="dense"
      variant="plain"
      emptyState={empty("No late or upcoming deliveries.")}
    />
  );
}

export function PaymentsDueTable({ rows }: { rows: PaymentDueRow[] }) {
  return (
    <DataTable
      columns={paymentColumns}
      data={rows}
      getRowId={(r) => r.id}
      density="dense"
      variant="plain"
      emptyState={empty("No payments due in the next 30 days.")}
    />
  );
}

export function ContainersTable({ rows }: { rows: ContainerRow[] }) {
  return (
    <DataTable
      columns={containerColumns}
      data={rows}
      getRowId={(r) => r.container}
      density="dense"
      variant="plain"
      emptyState={empty("No containers on the way.")}
    />
  );
}

/** A card whose source the role can't see, or that failed to load; a failure offers a retry (proposed wording). */
export function Unavailable({ source }: { source: "denied" | "failed" }) {
  const router = useRouter();
  if (source === "denied") return <p className="mt-[11px] text-sm text-muted-foreground">Not included in your access.</p>;
  return <ErrorState description="This section failed to load." onRetry={() => router.refresh()} />;
}
