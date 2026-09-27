import { apiClient } from './client';

export type DocumentRecord = {
  id: string;
  code: string;
  title: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentTemplateSummary = {
  id: string;
  code: string;
  name: string;
  type: string;
  updatedAt: string;
};

export type GenerateDocumentInput = {
  templateCode: string;
  title?: string;
  payload: Record<string, unknown>;
};

export type DocumentUploadResult = {
  url: string;
  size: number;
  mimeType: string;
  documentId: string;
  versionId: string;
};

export const documentsApi = {
  list: () => apiClient.get<DocumentRecord[]>('/documents'),
  listTemplates: () => apiClient.get<DocumentTemplateSummary[]>('/documents/templates'),
  generate: (input: GenerateDocumentInput) =>
    apiClient.post<DocumentRecord>('/documents/new/generate', input),
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'uploads');
    return apiClient.postForm<DocumentUploadResult>('/documents/upload', formData);
  },
};
