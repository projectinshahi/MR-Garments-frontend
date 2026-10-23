import type { ColumnDef } from "@tanstack/react-table";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DataTable } from "@/components/shared/data-table";

type Row = { id: string; name: string; qty: number };

const rows: Row[] = ["Delta", "Alpha", "Charlie", "Bravo"].map((name, i) => ({ id: String(i), name, qty: (i + 1) * 10 }));

const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name", footer: "Total" },
  { accessorKey: "qty", header: "Qty", meta: { align: "right" }, footer: () => rows.reduce((s, r) => s + r.qty, 0) },
];

const bodyNames = () =>
  within(screen.getAllByRole("rowgroup")[1]!)
    .getAllByRole("row")
    .map((row) => within(row).getAllByRole("cell")[0]!.textContent);

describe("DataTable", () => {
  it("shows every row and a totals footer when unpaginated", () => {
    render(<DataTable columns={columns} data={rows} />);
    expect(bodyNames()).toEqual(["Delta", "Alpha", "Charlie", "Bravo"]);
    const footer = screen.getAllByRole("rowgroup")[2]!;
    expect(within(footer).getByText("Total")).toBeInTheDocument();
    expect(within(footer).getByText("100")).toHaveClass("text-right");
    expect(screen.queryByRole("navigation", { name: "Table pagination" })).not.toBeInTheDocument();
  });

  it("paginates client-side with numbered pages", async () => {
    render(<DataTable columns={columns} data={rows} pagination={{ pageSize: 2, itemLabel: "items" }} />);
    expect(screen.getByText("Showing 1 to 2 of 4 items")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Page 2" }));
    expect(bodyNames()).toEqual(["Charlie", "Bravo"]);
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("supports manual pagination when only the current page is loaded", async () => {
    const onPageChange = vi.fn();
    render(<DataTable columns={columns} data={rows.slice(0, 2)} pagination={{ pageSize: 2, rowCount: 50, onPageChange }} />);
    expect(screen.getByText("Showing 1 to 2 of 50")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Page / })).toHaveLength(25);
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("marks the selected row and reports row clicks", async () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={columns} data={rows} getRowId={(r) => r.id} selectedRowId="2" onRowClick={onRowClick} />);
    const selected = screen.getByText("Charlie").closest("tr")!;
    expect(selected).toHaveAttribute("data-selected", "true");
    await userEvent.click(selected);
    expect(onRowClick).toHaveBeenCalledWith(rows[2]);
  });

  it("shows the empty state", () => {
    render(<DataTable columns={columns.map((c) => ({ ...c, footer: undefined }))} data={[]} emptyState="Nothing found" />);
    expect(screen.getByText("Nothing found")).toBeInTheDocument();
  });
});
