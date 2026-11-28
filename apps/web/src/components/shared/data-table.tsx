'use client';

import * as React from 'react';
import {
  type ColumnDef,
  type ColumnSizingState,
  type ColumnOrderState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  GripVertical,
  Search,
} from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from './empty-state';

type ColumnVisibilityState = Record<string, boolean>;
const EMPTY_COLUMN_VISIBILITY: ColumnVisibilityState = {};

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Show a client-side search box filtering across all columns. */
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: TData) => void;
  /** Minimum horizontal space for wide operational tables. */
  minTableWidth?: number;
  /** @deprecated Tables now auto-size to content and scroll inside their own container. */
  fitColumns?: boolean;
  /** Stable key for this table's per-browser column and pagination preferences. */
  tableId?: string;
  /** Render page filters before the column chooser in the table toolbar. */
  toolbarContent?: React.ReactNode;
  /** Initial hidden columns, used for newly introduced optional fields. */
  initialColumnVisibility?: ColumnVisibilityState;
}

function SortableColumnOption({
  id,
  label,
  visible,
  onToggle,
}: {
  id: string;
  label: string;
  visible: boolean;
  onToggle: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.65 : 1,
      }}
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
    >
      <input
        type="checkbox"
        checked={visible}
        onChange={onToggle}
        aria-label={`Hiển thị cột ${label}`}
        className="size-4 shrink-0 accent-emerald-600"
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
        {label}
      </span>
      <button
        type="button"
        aria-label={`Kéo để sắp xếp cột ${label}`}
        className="cursor-grab touch-none rounded p-1 text-ink-subtle hover:bg-canvas active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
    </div>
  );
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchable = true,
  searchPlaceholder = 'Tìm kiếm…',
  pageSize = 10,
  loading,
  emptyTitle = 'Chưa có dữ liệu',
  emptyDescription,
  onRowClick,
  minTableWidth = 0,
  tableId,
  toolbarContent,
  initialColumnVisibility = EMPTY_COLUMN_VISIBILITY,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize });
  const [columnsOpen, setColumnsOpen] = React.useState(false);
  const columnsPopoverRef = React.useRef<HTMLDivElement>(null);
  const columnIds = React.useMemo(
    () => columns.map((column, index) =>
      column.id ??
      ('accessorKey' in column && typeof column.accessorKey === 'string'
        ? column.accessorKey
        : typeof column.header === 'string'
          ? column.header
          : `column-${index}`),
    ),
    [columns],
  );
  const resolvedTableId = tableId ?? columnIds.join('|');
  const preferencesStorageKey = `nexus:data-table:${resolvedTableId}:columns`;
  const sizingStorageKey = `nexus:data-table:${resolvedTableId}:column-sizing`;
  const pageSizeStorageKey = `nexus:data-table:${resolvedTableId}:page-size`;
  const hasRestoredSizing = React.useRef(!sizingStorageKey);
  const [restoredPreferencesKey, setRestoredPreferencesKey] = React.useState<string | null>(null);
  const [restoredPageSizeKey, setRestoredPageSizeKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(pageSizeStorageKey));
      if (Number.isInteger(saved) && saved > 0) {
        setPagination({ pageIndex: 0, pageSize: saved });
      } else {
        setPagination({ pageIndex: 0, pageSize });
      }
    } catch {
      setPagination({ pageIndex: 0, pageSize });
    } finally {
      setRestoredPageSizeKey(pageSizeStorageKey);
    }
  }, [pageSize, pageSizeStorageKey]);

  React.useEffect(() => {
    if (restoredPageSizeKey !== pageSizeStorageKey) return;
    try {
      window.localStorage.setItem(pageSizeStorageKey, String(pagination.pageSize));
    } catch {
      // Continue using the selected page size when browser storage is unavailable.
    }
  }, [pageSizeStorageKey, pagination.pageSize, restoredPageSizeKey]);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(preferencesStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          order?: string[];
          visibility?: ColumnVisibilityState;
        };
        setColumnOrder(parsed.order ?? []);
        setColumnVisibility({
          ...initialColumnVisibility,
          ...parsed.visibility,
        });
      } else {
        setColumnOrder([]);
        setColumnVisibility(initialColumnVisibility);
      }
    } catch {
      window.localStorage.removeItem(preferencesStorageKey);
      setColumnOrder([]);
      setColumnVisibility(initialColumnVisibility);
    } finally {
      setRestoredPreferencesKey(preferencesStorageKey);
    }
  }, [initialColumnVisibility, preferencesStorageKey]);

  React.useEffect(() => {
    if (restoredPreferencesKey !== preferencesStorageKey) return;
    const validIds = new Set(columnIds);
    const nextOrder = [
      ...columnOrder.filter((id) => validIds.has(id)),
      ...columnIds.filter((id) => !columnOrder.includes(id)),
    ];
    if (nextOrder.length !== columnOrder.length) setColumnOrder(nextOrder);
    window.localStorage.setItem(
      preferencesStorageKey,
      JSON.stringify({ order: nextOrder, visibility: columnVisibility }),
    );
  }, [
    columnIds,
    columnOrder,
    columnVisibility,
    preferencesStorageKey,
    restoredPreferencesKey,
  ]);

  React.useEffect(() => {
    if (!columnsOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !columnsPopoverRef.current?.contains(event.target)
      ) {
        setColumnsOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [columnsOpen]);

  React.useEffect(() => {
    if (!sizingStorageKey) return;
    try {
      const saved = window.localStorage.getItem(sizingStorageKey);
      if (saved) setColumnSizing(JSON.parse(saved) as ColumnSizingState);
    } catch {
      window.localStorage.removeItem(sizingStorageKey);
    } finally {
      hasRestoredSizing.current = true;
    }
  }, [sizingStorageKey]);

  const handleColumnSizingChange = React.useCallback((updater: React.SetStateAction<ColumnSizingState>) => {
    setColumnSizing((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      if (sizingStorageKey && hasRestoredSizing.current) {
        window.localStorage.setItem(sizingStorageKey, JSON.stringify(next));
      }
      return next;
    });
  }, [sizingStorageKey]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnSizing, columnOrder, columnVisibility, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnSizingChange: handleColumnSizingChange,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;
  const filteredRowCount = table.getFilteredRowModel().rows.length;
  const pageSizeOptions = [...new Set([10, 25, 50, 100, pagination.pageSize])].sort(
    (a, b) => a - b,
  );
  const columnWidth = (id: string, configuredSize?: number) =>
    columnSizing[id] ?? configuredSize;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setColumnOrder((current) => {
      const order = current.length ? current : columnIds;
      const oldIndex = order.indexOf(String(active.id));
      const newIndex = order.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return order;
      const next = [...order];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      return next;
    });
  };

  return (
    <div className="w-full max-w-full min-w-0 space-y-3">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {toolbarContent}
        {searchable ? (
          <div className="flex min-w-52 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 sm:max-w-xs sm:flex-1">
            <Search className="size-4 text-ink-subtle" />
            <input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-subtle"
            />
          </div>
        ) : <span />}
        <div ref={columnsPopoverRef} className="relative ml-auto">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11 sm:min-h-9"
            aria-expanded={columnsOpen}
            aria-controls="data-table-column-options"
            onClick={() => setColumnsOpen((open) => !open)}
          >
            <Columns3 className="size-4" /> Cột
          </Button>
          {columnsOpen ? (
            <div
              id="data-table-column-options"
              className="absolute right-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-3 shadow-xl"
            >
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <h3 className="text-sm font-semibold text-ink">Tùy chỉnh hiển thị cột</h3>
                <button
                  type="button"
                  className="text-sm text-ink-muted hover:text-ink"
                  onClick={() => setColumnsOpen(false)}
                >
                  Đóng
                </button>
              </div>
              <div className="max-h-[min(65vh,28rem)] overflow-y-auto pr-1">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleColumnDragEnd}
                >
                  <SortableContext
                    items={table.getAllLeafColumns().map((column) => column.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {table.getAllLeafColumns().map((column) => {
                        const header = column.columnDef.header;
                        const label = typeof header === 'string' && header.trim()
                          ? header
                          : column.id;
                        return (
                          <SortableColumnOption
                            key={column.id}
                            id={column.id}
                            label={label}
                            visible={column.getIsVisible()}
                            onToggle={() => {
                              if (
                                column.getIsVisible() &&
                                table.getVisibleLeafColumns().length <= 1
                              ) return;
                              column.toggleVisibility();
                            }}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="w-full min-w-0 overflow-hidden rounded-card border border-border bg-card shadow-card">
        <div
          className="h-[min(46dvh,30rem)] min-h-0 w-full min-w-0 overflow-x-auto overflow-y-auto overscroll-contain sm:h-[min(62dvh,42rem)]"
        >
          <table
            className="table-auto w-full min-w-max text-sm"
            style={{ width: "100%", minWidth: minTableWidth || undefined }}
          >
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-border">
                  {hg.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    return (
                      <th
                        key={header.id}
                        className="sticky top-0 z-10 relative truncate whitespace-nowrap bg-card px-3 py-4 text-left text-xs font-medium text-ink-subtle sm:px-2 sm:py-3"
                        style={{ width: columnWidth(header.column.id, header.column.columnDef.size) }}
                      >
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1.5 transition-colors hover:text-ink"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <ArrowUpDown className="size-3" />
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                        {header.column.getCanResize() ? (
                          <div
                            onDoubleClick={() => header.column.resetSize()}
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className="absolute right-0 top-1/2 h-7 w-1 -translate-y-1/2 cursor-col-resize touch-none bg-border/70 opacity-0 transition-opacity hover:bg-accent-purple hover:opacity-100 focus:opacity-100"
                            title="Kéo để đổi độ rộng cột · nhấp đúp để đặt lại"
                          />
                        ) : null}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {columns.map((_, j) => (
                      <td key={j} className="px-3 py-4 sm:px-4 sm:py-3">
                        <Skeleton className="h-4 w-full max-w-32" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length ? (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick?.(row.original)}
                    className={cn(
                      'border-b border-border last:border-0 transition-colors',
                      onRowClick && 'cursor-pointer hover:bg-canvas',
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="overflow-hidden text-ellipsis whitespace-nowrap px-3 py-4 text-ink sm:px-2 sm:py-3" style={{ width: columnWidth(cell.column.id, cell.column.columnDef.size) }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length}>
                    <EmptyState
                      title={emptyTitle}
                      description={emptyDescription}
                      className="border-0 bg-transparent"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredRowCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted">
          <div className="flex items-center gap-2">
            <label htmlFor={`page-size-${resolvedTableId}`}>{"S\u1ed1 d\u00f2ng / trang"}</label>
            <select
              id={`page-size-${resolvedTableId}`}
              aria-label="Rows per page"
              value={table.getState().pagination.pageSize}
              onChange={(event) => table.setPageSize(Number(event.target.value))}
              className="h-9 rounded-xl border border-border bg-card px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/30"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="icon"
              className="min-h-11 min-w-11"
              aria-label="Previous page"
              title="Previous page"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft />
            </Button>
            <span className="whitespace-nowrap">
              Trang {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <Button
              variant="secondary"
              size="icon"
              className="min-h-11 min-w-11"
              aria-label="Next page"
              title="Next page"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
