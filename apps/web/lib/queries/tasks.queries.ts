import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TaskStatus, tasksApi } from '../api/tasks.api';

export const taskKeys = {
  all: ['tasks'] as const,
  list: () => [...taskKeys.all, 'list'] as const,
  summary: () => [...taskKeys.all, 'summary'] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
};

export function useTasksQuery() {
  return useQuery({
    queryKey: taskKeys.list(),
    queryFn: tasksApi.list,
  });
}

export function useTaskSummaryQuery() {
  return useQuery({
    queryKey: taskKeys.summary(),
    queryFn: tasksApi.getSummary,
  });
}

export function useUpdateTaskStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      tasksApi.updateStatus(id, status),
    onSuccess: async (task) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: taskKeys.list() }),
        queryClient.invalidateQueries({ queryKey: taskKeys.summary() }),
        queryClient.invalidateQueries({ queryKey: taskKeys.detail(task.id) }),
      ]);
    },
  });
}
