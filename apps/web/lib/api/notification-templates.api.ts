import { apiClient } from './client';

export type NotificationTemplateVariable = {
  path: string;
  label: string;
};

export type NotificationTemplateContent = {
  name: string;
  subject: string | null;
  body: string;
};

export type NotificationTemplateVersion = NotificationTemplateContent & {
  id: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED';
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationTemplateCatalogItem = {
  code: string;
  variables: NotificationTemplateVariable[];
  default: NotificationTemplateContent;
  effective: NotificationTemplateContent & {
    source: 'DEFAULT' | 'TENANT';
    version: number;
    publishedAt: string | null;
  };
  draft: NotificationTemplateVersion | null;
  versions: NotificationTemplateVersion[];
};

export type NotificationTemplateCatalogResponse = {
  templates: NotificationTemplateCatalogItem[];
};

export type NotificationTemplatePreview = {
  code: string;
  title: string;
  message: string;
  variables: NotificationTemplateVariable[];
};

type TemplatePayload = Partial<NotificationTemplateContent>;

export const notificationTemplatesApi = {
  list: () => apiClient.get<NotificationTemplateCatalogResponse>('/notifications/templates'),

  saveDraft: (code: string, payload: TemplatePayload) =>
    apiClient.patch<{ draft: NotificationTemplateVersion }>(`/notifications/templates/${encodeURIComponent(code)}/draft`, payload),

  preview: (code: string, payload: TemplatePayload) =>
    apiClient.post<NotificationTemplatePreview>(`/notifications/templates/${encodeURIComponent(code)}/preview`, payload),

  publish: (code: string) =>
    apiClient.post(`/notifications/templates/${encodeURIComponent(code)}/publish`, {}),

  rollback: (code: string, version: number) =>
    apiClient.post(`/notifications/templates/${encodeURIComponent(code)}/rollback/${version}`, {}),
};
