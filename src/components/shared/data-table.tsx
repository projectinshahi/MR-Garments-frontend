"use client";

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type Table as TanstackTable,
} from "@tanstack/react-table";

import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // Documented exception: interface merging requires TanStack's exact type-parameter names, which are unused here.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Numeric columns are right-aligned in the references. */
    align?: "left" | "right" | "center";
    /** Extra classes for this column's header, body and footer cells. */
    className?: string;
  }
}

const ROW_HEIGHT = { compact: "h-[39px]", default: "h-[53px]", tall: "h-[58px]" } as const;
const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const;

type DataTablePagination = {
  pageSize: number;
  /** Total records when only the current page is loaded ("Showing 1 to 10 of 50"); enables manual pagination. */
  rowCount?: number;
  /** Noun in "Showing 1 to 10 of 50 orders". */
  itemLabel?: string;
  /** Required with rowCount: called with the next page index. */
  onPageChange?: (pageIndex: number) => void;
};

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  /** Already searched/filtered by the caller. */
  data: TData[];
  getRowId?: (row: TData) => string;
  /** Row height: compact 39 (dashboard), default 53 (settings), tall 58 (orders). */
  density?: keyof typeof ROW_HEIGHT;
  /** card: bordered box with a tinted header (list pages). plain: no box, white header (tables inside a SectionCard). */
  variant?: "card" | "plain";
  /** Highlights the row (blue tint and left bar), as on Deposits & Payments and Landed Cost. */
  selectedRowId?: string;
  onRowClick?: (row: TData) => void;
  /** Shown in place of rows when `data` is empty. */
  emptyState?: React.ReactNode;
  /** Omit to show every row (most reference tables are unpaginated). */
  pagination?: DataTablePagination;
  className?: string;
};

/**
 * Totals rows come from column `footer` definitions and render under a 2 px navy rule.
 * Column alignment and extra classes come from `meta: { align, className }`.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  getRowId,
  density = "default",
  variant = "card",
  selectedRowId,
  onRowClick,
  emptyState = "No results.",
  pagination,
  className,
}: DataTableProps<TData, TValue>) {
  const manual = pagination?.rowCount !== undefined;
  const table = useReactTable({
    data,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    ...(pagination
      ? {
          getPaginationRowModel: manual ? undefined : getPaginationRowModel(),
          manualPagination: manual,
          rowCount: pagination.rowCount,
          initialState: { pagination: { pageIndex: 0, pageSize: pagination.pageSize } },
        }
      : {}),
  });
  const rows = table.getRowModel().rows;
  const hasFooter = columns.some((column) => column.footer !== undefined);
  const cellPad = variant === "card" ? "px-5 first:pl-5 last:pr-5" : "px-2 first:pl-2 last:pr-2";

  return (
    <div className={cn(variant === "card" && "overflow-hidden rounded-xl border bg-card", className)}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className={cn("border-b hover:bg-transparent", variant === "card" && "bg-table-head")}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    density === "compact" ? "h-9" : "h-11",
                    "text-[13px] font-bold text-table-head-foreground",
                    cellPad,
                    ALIGN[header.column.columnDef.meta?.align ?? "left"],
                    header.column.columnDef.meta?.className,
                  )}
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row) => (
              <TableRow
                key={row.id}
                data-selected={row.id === selectedRowId || undefined}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(
                  ROW_HEIGHT[density],
                  "border-b border-border-subtle hover:bg-transparent data-selected:bg-callout-info data-selected:shadow-[inset_3px_0_0_var(--primary)]",
                  onRowClick && "cursor-pointer",
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn("text-sm", cellPad, ALIGN[cell.column.columnDef.meta?.align ?? "left"], cell.column.columnDef.meta?.className)}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                {emptyState}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        {hasFooter ? (
          <TableFooter className="border-t-2 border-navy bg-table-head font-bold">
            {table.getFooterGroups().map((footerGroup) => (
              <TableRow key={footerGroup.id} className={cn(ROW_HEIGHT[density], "hover:bg-transparent")}>
                {footerGroup.headers.map((header) => (
                  <TableCell
                    key={header.id}
                    className={cn("text-sm", cellPad, ALIGN[header.column.columnDef.meta?.align ?? "left"], header.column.columnDef.meta?.className)}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.footer, header.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableFooter>
        ) : null}
      </Table>
      {pagination && table.getRowCount() > 0 ? <DataTablePager table={table} pagination={pagination} /> : null}
    </div>
  );
}

function DataTablePager<TData>({ table, pagination }: { table: TanstackTable<TData>; pagination: DataTablePagination }) {
  const total = table.getRowCount();
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const from = pageIndex * pageSize + 1;
  const to = Math.min(total, from + pageSize - 1);
  const go = (index: number) => {
    table.setPageIndex(index);
    pagination.onPageChange?.(index);
  };
  const box = "flex size-[30px] items-center justify-center rounded-md border bg-card text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

  return (
    <nav aria-label="Table pagination" className="flex items-center justify-between gap-4 border-t px-5 py-3.5">
      <p className="text-[13px] text-muted-foreground">
        Showing {from} to {to} of {total}
        {pagination.itemLabel ? ` ${pagination.itemLabel}` : ""}
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className={box} aria-label="Previous page" onClick={() => go(pageIndex - 1)} disabled={!table.getCanPreviousPage()}>
          ‹
        </button>
        {Array.from({ length: pageCount }, (_, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Page ${index + 1}`}
            aria-current={index === pageIndex ? "page" : undefined}
            onClick={() => go(index)}
            className={cn(box, index === pageIndex && "border-primary bg-primary font-bold text-white")}
          >
            {index + 1}
          </button>
        ))}
        <button type="button" className={box} aria-label="Next page" onClick={() => go(pageIndex + 1)} disabled={!table.getCanNextPage()}>
          ›
        </button>
      </div>
    </nav>
  );
}
