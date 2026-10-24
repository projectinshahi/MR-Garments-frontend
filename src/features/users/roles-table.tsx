"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/shared/data-table";
import { StatusPill } from "@/components/shared/status-pill";
import type { Access, Role, RoleMatrixRow, Tone } from "@/types/domain";

import type { RolesData } from "./data/queries";

const ACCESS_TONE: Record<Exclude<Access, "None">, Tone> = { Full: "success", Enter: "success", View: "info" };

// Column widths from 49_16.3_Roles.jpeg (cells padded 14.5 px). Warehouse staff takes the rest.
const WIDTHS: Record<Role, string | undefined> = {
  Management: "w-[151px]",
  Procurement: "w-[152px]",
  Accounts: "w-[122px]",
  "China staff": "w-[134px]",
  "India staff": "w-[127px]",
  "Warehouse staff": undefined,
};

function AccessCell({ access }: { access: Access }) {
  if (access === "None") {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden>–</span>
        <span className="sr-only">No access</span>
      </span>
    );
  }
  return <StatusPill tone={ACCESS_TONE[access]}>{access}</StatusPill>;
}

const columnsFor = (roles: Role[]): ColumnDef<RoleMatrixRow>[] => [
  { accessorKey: "capability", header: "What they can do", meta: { className: "w-[268px] font-bold" } },
  ...roles.map(
    (role): ColumnDef<RoleMatrixRow> => ({
      id: role,
      header: role,
      meta: { className: WIDTHS[role] },
      cell: ({ row }) => <AccessCell access={row.original.access[role]} />,
    }),
  ),
];

/** Read-only permission matrix (49). "Roles are fixed in this first version." */
export function RolesTable({ roles, rows }: RolesData) {
  return <DataTable columns={columnsFor(roles)} data={rows} getRowId={(r) => r.capability} density="short" size="sm" />;
}
