import React from "react";
import { LoadingState } from "./LoadingState";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";

export interface Column<T> {
  header: React.ReactNode;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
  render?: (row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  'data-testid'?: string;
  rowTestId?: string | ((row: T) => string);
}

export function Table<T extends { id?: string | number }>({
  columns,
  data,
  isLoading,
  isError,
  onRetry,
  emptyMessage,
  onRowClick,
  'data-testid': testId,
  rowTestId
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div data-testid={testId} className="w-full bg-card border border-border rounded-2xl overflow-hidden">
        <LoadingState />
      </div>
    );
  }

  if (isError) {
    return (
      <div data-testid={testId} className="w-full bg-card border border-border rounded-2xl overflow-hidden">
        <ErrorState onRetry={onRetry} />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div data-testid={testId} className="w-full bg-card border border-border rounded-2xl overflow-hidden">
        <EmptyState message={emptyMessage} />
      </div>
    );
  }

  return (
    <div data-testid={testId} className="w-full overflow-x-auto bg-card border border-border rounded-2xl shadow-sm">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-muted uppercase bg-surface border-b border-border">
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} className={`px-4 py-3 font-bold ${col.className || ""}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr 
              key={row.id || rowIndex} 
              data-testid={typeof rowTestId === 'function' ? rowTestId(row) : rowTestId}
              className={`border-b border-border hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col, colIndex) => (
                <td key={colIndex} className={`px-4 py-3 ${col.className || ""}`}>
                  {col.render ? col.render(row) : (typeof col.accessor === "function" ? col.accessor(row) : (row[col.accessor as keyof T] as React.ReactNode))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
