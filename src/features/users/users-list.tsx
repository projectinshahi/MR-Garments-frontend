"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { FilterChips, FilterSelect, SearchInput } from "@/components/shared/filters";
import { StatusPill } from "@/components/shared/status-pill";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { handleApiError, notifyError, notifySuccess } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import type { Role, User } from "@/types/domain";

import type { UsersListData } from "./data/queries";
import { ALL, filterUsers, type UserFilters, type UserStatusFilter } from "./filter-users";
import { DEACTIVATE_NOTE } from "./user-form";

const actionClass = "rounded-sm text-[13px] font-bold outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

function EditAction({ user }: { user: User }) {
  return (
    <Link href={`/users/edit?id=${encodeURIComponent(user.id)}`} aria-label={`Edit ${user.name}`} className={cn(actionClass, "text-primary")}>
      Edit
    </Link>
  );
}

// Proposed wording (docs/orders-users-contract.md, USR-5).
export const REMOVE_TEXT = {
  removed: "User removed",
  deactivated: "User deactivated",
  alreadyRemoved: "User was already removed.",
  alreadyInactive: "They're already inactive, so they can't sign in.",
};

/**
 * Remove (USR-5) asks first; Cancel sends nothing. The API removes only an unused account (D3): one that has signed in
 * or recorded anything is refused (409 `in_use`), and the same dialog offers to deactivate an active user instead
 * (USR-4) or, for one already inactive, explains and only closes. Your own account and the last active Management user
 * are refused with a toast. Any other failure toasts and keeps the dialog open, so confirming again retries. As
 * Settings' DeleteButton.
 */
function RemoveAction({ user }: { user: User }) {
  const router = useRouter();
  // null: closed. "ask": the remove confirmation. An object: the API's reason the user can't be removed.
  const [step, setStep] = useState<null | "ask" | { inUse: string }>(null);
  const path = `/users/${encodeURIComponent(user.id)}`;

  function done(message: string) {
    setStep(null);
    notifySuccess(message);
    router.refresh();
  }
  async function send(request: () => Promise<unknown>, success: string) {
    try {
      await request();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return done(REMOVE_TEXT.alreadyRemoved);
      // The API's message ends "Deactivate them instead.", which the in-use step offers as its button.
      if (error instanceof ApiError && error.status === 409 && error.code === "in_use")
        return setStep({ inUse: error.message.replace(/\s*Deactivate them instead\.$/, "") });
      // handleApiError leaves field errors to a form (the PATCH `own_account` refusal carries `fields.status`); this
      // list has no fields, so they are toasted here.
      new Set(Object.values(handleApiError(error) ?? {})).forEach((message) => notifyError(message));
      // Your own account or the last active Management user: trying again can't help.
      if (error instanceof ApiError && (error.code === "own_account" || error.code === "last_management")) setStep(null);
      return;
    }
    done(success);
  }

  const inUse = step !== null && step !== "ask" ? step.inUse : null;
  const dialog =
    inUse === null
      ? {
          tone: "danger" as const,
          title: "Remove user?",
          description: (
            <p>
              Are you sure you want to remove <strong className="text-foreground">{user.name}</strong> ({user.email})? This can&apos;t be undone.
              A user who has signed in or recorded anything can&apos;t be removed, but you can deactivate them.
            </p>
          ),
          confirmLabel: "Remove user",
          pendingLabel: "Removing…",
          onConfirm: () => send(() => apiClient.delete(path), REMOVE_TEXT.removed),
        }
      : user.status === "Active"
        ? {
            title: "Deactivate user instead?",
            description: (
              <>
                <p>{inUse}</p>
                <p>{DEACTIVATE_NOTE}</p>
              </>
            ),
            confirmLabel: "Deactivate user",
            pendingLabel: "Deactivating…",
            onConfirm: () => send(() => apiClient.patch(path, { status: "Inactive" }), REMOVE_TEXT.deactivated),
          }
        : {
            title: "Can't remove user",
            description: (
              <>
                <p>{inUse}</p>
                <p>{REMOVE_TEXT.alreadyInactive}</p>
              </>
            ),
          };

  return (
    <>
      <button type="button" aria-label={`Remove ${user.name}`} className={cn(actionClass, "text-danger")} onClick={() => setStep("ask")}>
        Remove
      </button>
      <ConfirmDialog open={step !== null} onCancel={() => setStep(null)} {...dialog} />
    </>
  );
}

// Column widths from 47_16.1_Users_list.jpeg (cells padded 14.5 px). The actions take the rest.
const COLUMNS: ColumnDef<User>[] = [
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
];

/** Edit on every row; Remove only with admin Full (D1) and never on your own row (D3). Remove isn't in 47: the owner asked. */
const actionsColumn = (canManage: boolean, meId: string | null): ColumnDef<User> => ({
  id: "actions",
  header: () => <span className="sr-only">Actions</span>,
  cell: ({ row }) => (
    <div className="flex gap-3 whitespace-nowrap">
      <EditAction user={row.original} />
      {canManage && row.original.id !== meId ? <RemoveAction user={row.original} /> : null}
    </div>
  ),
});

/** Users list body (47): search, role and status filters, the users table and its footnote. Filters run on the client. */
export function UsersList({ users, counts, roles, canManage, meId }: UsersListData) {
  const columns = useMemo(() => [...COLUMNS, actionsColumn(canManage, meId)], [canManage, meId]);
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
            { value: "active", label: `Active (${counts.active})` },
            { value: "inactive", label: `Inactive (${counts.inactive})` },
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
