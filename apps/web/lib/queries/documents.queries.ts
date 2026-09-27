import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsApi, type GenerateDocumentInput } from '../api/documents.api';

export const documentKeys = {
  all: ['documents'] as const,
  list: () => [...documentKeys.all, 'list'] as const,
  templates: () => [...documentKeys.all, 'templates'] as const,
};

export function useDocumentsQuery() {
  return useQuery({
    queryKey: documentKeys.list(),
    queryFn: documentsApi.list,
  });
}

export function useDocumentTemplatesQuery(enabled = true) {
  return useQuery({
    queryKey: documentKeys.templates(),
    queryFn: documentsApi.listTemplates,
    enabled,
  });
}

export function useGenerateDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: GenerateDocumentInput) => documentsApi.generate(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: documentKeys.list() });
    },
  });
}

export function useUploadDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => documentsApi.upload(file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: documentKeys.list() });
    },
  });
}
