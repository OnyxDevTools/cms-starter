"use client";
// filename: admin/table.tsx
import { useMemo, useState } from "react";
import {
  useTable,
  tableFeatures,
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  createFilteredRowModel,
  createSortedRowModel,
  createPaginatedRowModel,
  filterFn_includesString,
  sortFn_alphanumeric,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  sortFns: { alphanumeric: sortFn_alphanumeric },
});
export type TableRow = { id: string; [key: string]: string };
export function AdminTable({
  rows,
  fields,
  filterField,
  kind = "content",
}: {
  rows: TableRow[];
  fields: { key: string; label: string }[];
  filterField?: string;
  kind?: "content" | "media" | "plain";
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo<ColumnDef<typeof features, TableRow>[]>(
    () =>
      fields.map((field, index) => ({
        accessorKey: field.key,
        header: field.label,
        cell: ({ row, getValue }) =>
          index === 0 && (kind !== "plain" || !!row.original.href) ? (
            <a
              href={
                row.original.href ||
                (kind === "media"
                  ? `/admin/media?id=${row.original.id}`
                  : `/admin/${row.original.id}`)
              }
            >
              {String(getValue() || "Untitled")}
            </a>
          ) : field.key === "updatedAt" ? (
            new Date(String(getValue())).toLocaleDateString()
          ) : (
            String(getValue() || "—")
          ),
      })),
    [fields, kind],
  );
  const filtered = useMemo(
    () =>
      filter && filterField
        ? rows.filter((row) => row[filterField] === filter)
        : rows,
    [rows, filter, filterField],
  );
  const table = useTable({
    features,
    data: filtered,
    columns,
    globalFilterFn: "includesString",
    state: { globalFilter: search, sorting },
    onGlobalFilterChange: setSearch,
    onSortingChange: setSorting,
    initialState: { pagination: { pageIndex: 0, pageSize: 15 } },
  });
  return (
    <section className="panel table-panel">
      <div className="table-toolbar">
        <label className="field">
          Search
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search this collection…"
          />
        </label>
        {filterField && (
          <label className="field">
            Filter
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All</option>
              {Array.from(new Set(rows.map((row) => row[filterField])))
                .sort()
                .map((v) => (
                  <option key={v}>{v}</option>
                ))}
            </select>
          </label>
        )}
        <span className="muted small">
          {table.getFilteredRowModel().rows.length} items
        </span>
      </div>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Content records"
      >
        <table className="admin-table">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id}>
                    <button
                      type="button"
                      className="sort-button"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {header.column.getIsSorted() === "asc"
                        ? " ↑"
                        : header.column.getIsSorted() === "desc"
                          ? " ↓"
                          : ""}
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getAllCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!table.getRowModel().rows.length && (
          <div className="empty-state">
            <h2>Nothing here yet.</h2>
            <p>Create your first item, or try another search.</p>
          </div>
        )}
      </div>
      <div className="table-pagination">
        <span className="small muted">
          Page {table.state.pagination.pageIndex + 1} of{" "}
          {Math.max(table.getPageCount(), 1)}
        </span>
        <Button
          variant="outline"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
        >
          Next
        </Button>
      </div>
    </section>
  );
}
