"use client";

import {
  useTable,
  flexRender,
  columnVisibilityFeature,
} from "@tanstack/react-table";
import {
  createColumnHelper,
  createCoreRowModel,
  createSortedRowModel,
  createFilteredRowModel,
  createPaginatedRowModel,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  PaginationState,
  RowSelectionState,
} from "@tanstack/table-core";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, MoreHorizontal, Search, Download, Columns3, X, Loader2 } from "lucide-react";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ColumnDef<TData> {
  id: string;
  header: string;
  accessorKey?: keyof TData;
  cell?: (info: { getValue: () => unknown; row: { original: TData } }) => React.ReactNode;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  filterFn?: (row: TData, columnId: string, value: unknown) => boolean;
  meta?: {
    align?: "left" | "center" | "right";
    className?: string;
    headerClassName?: string;
  };
}

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  keyField: keyof TData | ((row: TData) => string);
  searchKey?: string;
  searchPlaceholder?: string;
  pageSize?: number;
  showSearch?: boolean;
  showPagination?: boolean;
  showColumnVisibility?: boolean;
  showRowSelection?: boolean;
  onRowSelect?: (selectedIds: string[]) => void;
  selectedIds?: string[];
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  dateRangeFilter?: { start: string; end: string } | null;
  onDateRangeChange?: (range: { start: string; end: string } | null) => void;
  dateRangePlaceholder?: string;
  additionalFilters?: React.ReactNode;
  toolbar?: React.ReactNode;
  summary?: React.ReactNode;
}

export function DataTable<TData extends Record<string, unknown>>({
  columns: userColumns,
  data,
  keyField,
  searchKey,
  searchPlaceholder = "Search...",
  pageSize: initialPageSize = 12,
  showSearch = true,
  showPagination = true,
  showColumnVisibility = true,
  showRowSelection = false,
  onRowSelect,
  selectedIds = [],
  loading = false,
  emptyMessage = "No data found.",
  className = "",
  dateRangeFilter,
  onDateRangeChange,
  dateRangePlaceholder = "Select date range",
  additionalFilters,
  toolbar,
  summary,
}: DataTableProps<TData>) {
  const columnHelper = useMemo(() => createColumnHelper<TData>(), []);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState("");

  const getRowId = useCallback((row: TData) => {
    if (typeof keyField === "function") {
      return keyField(row);
    }
    return String(row[keyField]);
  }, [keyField]);

  const columns = useMemo(() => {
    const baseColumns = userColumns.map((col) =>
      columnHelper.accessor(col.accessorKey as string, {
        id: col.id,
        header: col.header,
        cell: col.cell
          ? (info) => flexRender(col.cell!(info), info)
          : (info) => flexRender(info.column.columnDef.id, info),
        enableSorting: col.enableSorting ?? true,
        enableFiltering: col.enableFiltering ?? false,
        filterFn: col.filterFn,
        meta: col.meta,
      })
    );

    if (showRowSelection) {
      return [
        columnHelper.display({
          id: "select",
          header: ({ table }) =>
            <Checkbox
              checked={table.getIsAllPageRowsSelected()}
              indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all"
            />,
          cell: ({ row }) =>
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label={`Select row ${getRowId(row.original)}`}
            />,
          enableSorting: false,
          enableFiltering: false,
          size: 40,
          meta: { align: "center" },
        }),
        ...baseColumns,
      ];
    }
    return baseColumns;
  }, [userColumns, columnHelper, showRowSelection, getRowId]);

  const table = useTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
      rowSelection,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: createCoreRowModel(),
    getSortedRowModel: createSortedRowModel(),
    getFilteredRowModel: createFilteredRowModel(),
    getPaginationRowModel: createPaginatedRowModel(),
    getRowId,
    manualPagination: false,
    manualSorting: false,
    manualFiltering: false,
  }, [columnVisibilityFeature]);

  useEffect(() => {
    if (onRowSelect) {
      const ids = Array.from(rowSelection.keys());
      onRowSelect(ids);
    }
  }, [rowSelection, onRowSelect]);

  useEffect(() => {
    if (selectedIds.length > 0) {
      setRowSelection({});
      selectedIds.forEach((id) => setRowSelection((prev) => ({ ...prev, [id]: true })));
    }
  }, [selectedIds]);

  const visibleColumns = table.getAllLeafColumns().filter((col) => col.getIsVisible());

  const handleSort = (columnId: string) => {
    const column = table.getColumn(columnId);
    if (!column.getCanSort()) return;
    const currentSort = sorting.find((s) => s.id === columnId);
    if (currentSort) {
      setSorting((prev) =>
        prev.map((s) => (s.id === columnId ? { ...s, desc: !s.desc } : s))
      );
    } else {
      setSorting([{ id: columnId, desc: false }]);
    }
  };

  const renderSortIcon = (columnId: string) => {
    const column = table.getColumn(columnId);
    if (!column.getCanSort()) return null;
    const currentSort = sorting.find((s) => s.id === columnId);
    if (currentSort) {
      return currentSort.desc ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />;
    }
    return <ChevronDown className="size-3.5 text-muted-foreground/50" />;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {toolbar && <div>{toolbar}</div>}

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 shadow-xs">
        {showSearch && (
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-9 pl-9 bg-background"
            />
          </div>
        )}

        {dateRangeFilter !== undefined && onDateRangeChange && (
          <Popover open={!!dateRangeFilter} onOpenChange={(open) => !open && onDateRangeChange(null)}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2 font-normal text-foreground w-[280px] justify-start">
                <CalendarIcon className="size-4 text-muted-foreground" />
                <span>{dateRangeFilter ? `${dateRangeFilter.start} → ${dateRangeFilter.end}` : dateRangePlaceholder}</span>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-3">
              <CalendarIcon className="size-4" />
            </PopoverContent>
          </Popover>
        )}

        {additionalFilters}

        {showColumnVisibility && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2 ml-auto">
                <Columns3 className="size-4 text-muted-foreground" />
                <span>Columns</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs">Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllLeafColumns()
                .filter((col) => col.id !== "select")
                .map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={col.getIsVisible()}
                    onCheckedChange={(checked) => col.toggleVisibility(!!checked)}
                  >
                    {col.columnDef.header}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {summary && <div>{summary}</div>}

      <div className="rounded-lg border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                        header.column.getCanSort() && "cursor-pointer select-none hover:text-foreground",
                        header.column.getSize() <= 50 && "w-10",
                        header.column.columnDef.meta?.align === "center" && "text-center",
                        header.column.columnDef.meta?.align === "right" && "text-right",
                        header.column.columnDef.meta?.headerClassName
                      )}
                      onClick={() => header.column.getCanSort() && handleSort(header.column.id)}
                      style={{ width: header.getSize() }}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && renderSortIcon(header.column.id)}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {visibleColumns.map((col) => (
                      <TableCell key={col.id} className={cn(col.columnDef.meta?.className, col.columnDef.meta?.align === "center" && "text-center", col.columnDef.meta?.align === "right" && "text-right")}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length} className="py-12 text-center text-sm text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className={cn("hover:bg-muted/50 transition-colors", row.original.__rowClassName)}
                  >
                    {visibleColumns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn(
                          col.columnDef.meta?.className,
                          col.columnDef.meta?.align === "center" && "text-center",
                          col.columnDef.meta?.align === "right" && "text-right"
                        )}
                      >
                        {flexRender(col.columnDef.cell, col.getContext(row))}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {showPagination && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-card text-xs text-muted-foreground">
            <div>
              Showing {table.getRowModel().rows.length > 0 ? pagination.pageIndex * pagination.pageSize + 1 : 0}–
              {Math.min((pagination.pageIndex + 1) * pagination.pageSize, table.getRowModel().rows.length)} of {table.getRowModel().rows.length}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8 rounded"
                disabled={pagination.pageIndex <= 0 || loading}
                onClick={() => table.previousPage()}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </Button>

              {Array.from({ length: table.getPageCount() }).map((_, i) => {
                const pageNum = i + 1;
                if (
                  table.getPageCount() > 6 &&
                  pageNum !== 1 &&
                  pageNum !== table.getPageCount() &&
                  Math.abs(pageNum - (pagination.pageIndex + 1)) > 1
                ) {
                  if (pageNum === 2 || pageNum === table.getPageCount() - 1) {
                    return (
                      <span key={pageNum} className="px-1 text-muted-foreground">
                        …
                      </span>
                    );
                  }
                  return null;
                }

                const isActive = pageNum === pagination.pageIndex + 1;
                return (
                  <Button
                    key={pageNum}
                    variant={isActive ? "default" : "outline"}
                    size="icon"
                    className={cn(
                      "size-8 rounded text-xs font-medium",
                      isActive
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "text-muted-foreground"
                    )}
                    onClick={() => table.setPageIndex(pageNum - 1)}
                  >
                    {pageNum}
                  </Button>
                );
              })}

              <Button
                variant="outline"
                size="icon"
                className="size-8 rounded"
                disabled={pagination.pageIndex >= table.getPageCount() - 1 || loading}
                onClick={() => table.nextPage()}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}