import { apiClient } from './client';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TaskRecord = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskSummary = {
  total: number;
  todo: number;
  inProgress: number;
  review: number;
  done: number;
  cancelled: number;
  overdue: number;
};

export const tasksApi = {
  list: () => apiClient.get<TaskRecord[]>('/tasks'),
  getSummary: () => apiClient.get<TaskSummary>('/tasks/summary'),
  getDetail: (id: string) => apiClient.get<TaskRecord>(`/tasks/${id}`),
  updateStatus: (id: string, status: TaskStatus) =>
    apiClient.patch<TaskRecord>(`/tasks/${id}/status`, { status }),
};
