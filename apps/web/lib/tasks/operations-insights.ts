import type { TaskPriority, TaskStatus } from "@/lib/api/tasks.api";

export type OperationsInsightTask = {
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
};

export type OperationsInsightMetrics = {
  open: number;
  overdue: number;
  urgent: number;
  review: number;
};

export type OperationsInsightsState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "unavailable" }
  | { kind: "ready"; metrics: OperationsInsightMetrics };

const activeStatuses = new Set<TaskStatus>(["TODO", "IN_PROGRESS", "REVIEW"]);

function isOverdue(dueDate: string | null, now: Date) {
  if (!dueDate) return false;

  const dueAt = new Date(dueDate);
  return !Number.isNaN(dueAt.getTime()) && dueAt.getTime() < now.getTime();
}

export function getOperationsInsights(
  tasks: readonly OperationsInsightTask[] | undefined,
  options: { isLoading?: boolean; isError?: boolean; now?: Date } = {},
): OperationsInsightsState {
  if (options.isError) return { kind: "error" };
  if (options.isLoading) return { kind: "loading" };
  if (!tasks) return { kind: "unavailable" };

  const now = options.now ?? new Date();
  const metrics: OperationsInsightMetrics = { open: 0, overdue: 0, urgent: 0, review: 0 };

  for (const task of tasks) {
    if (!activeStatuses.has(task.status)) continue;

    metrics.open += 1;
    if (task.status === "REVIEW") metrics.review += 1;
    if (task.priority === "URGENT") metrics.urgent += 1;
    if (isOverdue(task.dueDate, now)) metrics.overdue += 1;
  }

  return { kind: "ready", metrics };
}
