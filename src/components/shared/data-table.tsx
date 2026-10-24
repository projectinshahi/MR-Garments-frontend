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

// dense rows have no fixed height: 9 px padding around a 16 px line gives 35 px text rows and 39 px rows with a
// 20 px StatusPill, as in the dashboard cards (04).
// short 37: calendar list and roles (20, 49). snug 49: bordered tables inside order-detail cards (08, 12, 13, 14).
// relaxed 61: containers list (24). loose 65: two-line cells on transport, warehouse and users (28, 30, 47).
const ROW_HEIGHT = {
  dense: "",
  short: "h-[37px]",
  compact: "h-[39px]",
  snug: "h-[49px]",
  default: "h-[53px]",
  tall: "h-[58px]",
  relaxed: "h-[61px]",
  loose: "h-[65px]",
} as const;
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
  /**
   * Row height: dense (dashboard cards: 12 px headers, 13.5 px cells, 35 px rows or 39 px with pills, 6 px outer
   * padding), short 37, compact 39, snug 49 (order-detail tables), default 53 (settings), tall 58 (orders),
   * relaxed 61, loose 65 (two-line cells). The totals row is 49 px whatever the density.
   */
  density?: keyof typeof ROW_HEIGHT;
  /**
   * sm: the header and padding measured in the Wave 1 bordered tables (07–14, 20): 34 px header row with
   * 12.5 px text, 14.5 px cell padding in `card`. Row height still comes from `density`. No effect with `dense`.
   */
  size?: "default" | "sm";
  /**
   * tall: a 38 px header band (39 px from the card's top border to the header rule) with the label in a 38 px line
   * box, as in the list tables 05, 22, 24, 26, 28, 30, 33, 35, 37, 38 and 40–47. Combine with `size="sm"` for its text
   * and padding. No effect with `dense`.
   */
  header?: "default" | "tall";
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
  size = "default",
  header: headerHeight = "default",
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
  const dense = density === "dense";
  const sm = size === "sm" && !dense;
  const cellPad =
    variant === "card"
      ? sm
        ? "px-[14.5px] first:pl-[14.5px] last:pr-[14.5px]"
        : "px-5 first:pl-5 last:pr-5"
      : dense
        ? "px-2 first:pl-1.5 last:pr-1.5"
        : "px-2 first:pl-2 last:pr-2";
  const cellText = dense ? "py-[9px] text-[13.5px] leading-4" : "text-sm";

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
                    // dense: the header sits right under a SectionCard title (titleGap="none"), text low in its 36 px.
                    dense ? "h-9 pt-[7px]" : headerHeight === "tall" ? "h-[39px]" : sm ? "h-[34px]" : density === "compact" ? "h-9" : "h-11",
                    dense ? "text-xs" : sm ? "text-[12.5px]" : "text-[13px]",
                    // tall: centring a normal line in the cell sets the label 1 px above every reference; a 38 px line box
                    // matches. After the font size: tailwind-merge drops a leading class that a later font-size class follows.
                    !dense && headerHeight === "tall" && "leading-[38px]",
                    "font-bold text-table-head-foreground",
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
                    className={cn(cellText, cellPad, ALIGN[cell.column.columnDef.meta?.align ?? "left"], cell.column.columnDef.meta?.className)}
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
              // Every reference totals row is 48 px from the navy rule to the table's bottom border (07, 13, 26, 28, 30,
              // 37, 38), whatever the body density; a 49 px row renders that inside the collapsed border.
              <TableRow key={footerGroup.id} className="h-[49px] hover:bg-transparent">
                {footerGroup.headers.map((header) => (
                  <TableCell
                    key={header.id}
                    className={cn(cellText, cellPad, ALIGN[header.column.columnDef.meta?.align ?? "left"], header.column.columnDef.meta?.className)}
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
