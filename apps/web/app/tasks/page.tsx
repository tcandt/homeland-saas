"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import OperationsMobileFlow from "@/components/tasks/OperationsMobileFlow";
import OperationsKpi from "@/components/tasks/OperationsKpi";
import OperationsBoard from "@/components/tasks/OperationsBoard";
import OperationsInsights from "@/components/tasks/OperationsInsights";
import type { TaskStatus } from "@/lib/api/tasks.api";
import { useTasksQuery, useTaskSummaryQuery, useUpdateTaskStatusMutation } from "@/lib/queries/tasks.queries";

export default function TasksPage() {
  const tasksQuery = useTasksQuery();
  const summaryQuery = useTaskSummaryQuery();
  const updateStatus = useUpdateTaskStatusMutation();
  const [error, setError] = useState<string | null>(null);
  const tickets = tasksQuery.data || [];

  const handleStatusChange = async (ticket: (typeof tickets)[number], status: TaskStatus) => {
    setError(null);
    try {
      await updateStatus.mutateAsync({ id: ticket.id, status });
    } catch {
      setError("Không thể cập nhật trạng thái công việc. Vui lòng thử lại.");
      throw new Error("TASK_STATUS_UPDATE_FAILED");
    }
  };

  const loadError = tasksQuery.isError || summaryQuery.isError;

  return (
    <AppShell>
      <div className="block md:hidden">
        <div className="mb-4">
          <h1 className="font-black text-[22px] text-text">Công việc vận hành</h1>
          <p className="text-[13px] font-medium text-muted mt-1">Theo dõi và cập nhật các công việc theo trạng thái.</p>
        </div>
        {loadError || error ? <p role="alert" className="mb-3 text-[13px] font-medium text-danger">{error || "Không thể tải dữ liệu công việc."}</p> : null}
        <OperationsMobileFlow tickets={tickets} summary={summaryQuery.data} isLoading={tasksQuery.isLoading || summaryQuery.isLoading} isUpdating={updateStatus.isPending} onStatusChange={handleStatusChange} />
      </div>

      <div className="hidden md:flex relative w-full min-h-full gap-[24px]">
        <div className="flex-1 flex flex-col gap-[24px] min-w-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-4">
            <div>
              <h1 className="font-black text-[24px] md:text-[28px] text-text">Công việc vận hành</h1>
              <p className="text-[13px] font-medium text-muted mt-1">Dữ liệu công việc theo thời gian thực của đơn vị hiện tại.</p>
            </div>
          </div>
          {loadError || error ? <p role="alert" className="text-[13px] font-medium text-danger">{error || "Không thể tải dữ liệu công việc."}</p> : null}
          <OperationsKpi summary={summaryQuery.data} isLoading={summaryQuery.isLoading} />
          <OperationsInsights tasks={tasksQuery.data} isLoading={tasksQuery.isLoading} isError={tasksQuery.isError} />
          <OperationsBoard tickets={tickets} isLoading={tasksQuery.isLoading} isUpdating={updateStatus.isPending} onStatusChange={handleStatusChange} />
        </div>
      </div>
    </AppShell>
  );
}
