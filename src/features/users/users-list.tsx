"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useState } from "react";

import { DataTable } from "@/components/shared/data-table";
import { FilterChips, FilterSelect, SearchInput } from "@/components/shared/filters";
import { notInPrototype } from "@/components/shared/prototype";
import { StatusPill } from "@/components/shared/status-pill";
import type { Role } from "@/types/domain";

import type { UserRow, UsersListData } from "./data/queries";
import { ALL, countByStatus, filterUsers, type UserFilters, type UserStatusFilter } from "./filter-users";

const editClass = "rounded-sm text-[13px] font-bold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

function EditAction({ user }: { user: UserRow }) {
  const label = `Edit ${user.name}`;
  return user.editable ? (
    <Link href="/users/edit" aria-label={label} className={editClass}>
      Edit
    </Link>
  ) : (
    <button type="button" aria-label={label} onClick={() => notInPrototype(label)} className={editClass}>
      Edit
    </button>
  );
}

// Column widths from 47_16.1_Users_list.jpeg (cells padded 14.5 px). Edit takes the rest.
const columns: ColumnDef<UserRow>[] = [
  {
    accessorKey: "name",
    header: "User",
    meta: { className: "w-[272px]" },
    cell: ({ row }) => (
      <div className="flex flex-col justify-center leading-4">
        <span className="font-bold">{row.original.name}</span>
        <span className="text-[12.5px] text-muted-foreground">{row.original.email}</span>
      </div>
    ),
  },
  {
    accessorKey: "role",
    header: "Role",
    meta: { className: "w-[221px]" },
    cell: ({ row }) => <StatusPill tone={row.original.role === "Management" ? "purple" : "info"}>{row.original.role}</StatusPill>,
  },
  { accessorKey: "office", header: "Office", meta: { className: "w-[218px]" } },
  { accessorKey: "lastSignIn", header: "Last sign-in", meta: { className: "w-[209px]" } },
  {
    accessorKey: "status",
    header: "Status",
    meta: { className: "w-[130px]" },
    cell: ({ row }) => <StatusPill tone={row.original.status === "Active" ? "success" : "neutral"}>{row.original.status}</StatusPill>,
  },
  { id: "edit", header: () => <span className="sr-only">Actions</span>, cell: ({ row }) => <EditAction user={row.original} /> },
];

/** Users list body (47): search, role and status filters, the users table and its footnote. Filters run on the client. */
export function UsersList({ users, roles }: UsersListData) {
  const [filters, setFilters] = useState<UserFilters>({ query: "", role: ALL, status: "active" });
  const set = (patch: Partial<UserFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const rows = filterUsers(users, filters);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <SearchInput
            size="sm"
            label="Search users by name or email"
            inlineLabel="Search"
            placeholder="name or email"
            value={filters.query}
            onValueChange={(query) => set({ query })}
            placeholderTone="label"
            // 47 draws a 40 px tall (sm is 38), 163 px wide box with sm's 13.5 px text.
            className="h-10 w-[163px]"
          />
          <FilterSelect
            label="Role"
            size="sm"
            value={filters.role}
            options={[{ value: ALL, label: "All roles" }, ...roles.map((role) => ({ value: role, label: role }))]}
            onValueChange={(role) => set({ role: role as Role | typeof ALL })}
          />
        </div>
        <FilterChips
          label="User status"
          size="sm"
          options={[
            { value: "active", label: `Active (${countByStatus(users, "Active")})` },
            { value: "inactive", label: `Inactive (${countByStatus(users, "Inactive")})` },
            { value: ALL, label: "All" },
          ]}
          value={filters.status}
          onValueChange={(status) => set({ status: status as UserStatusFilter })}
        />
      </div>

      <DataTable columns={columns} data={rows} getRowId={(u) => u.id} density="loose" size="sm" header="tall" emptyState="No users match these filters." />

      <p className="text-[12.5px] leading-4 text-muted-foreground">
        Staff with an entry role can enter data for their own stage only. They cannot see costs, payments or reports.
      </p>
    </>
  );
}
