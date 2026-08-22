import { apiClient } from './client';

export interface User {
  id: string;
  email: string;
  fullName: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  mustChangePassword?: boolean;
  avatarUrl?: string | null;
}

export interface CurrentUserProfile extends User {
  tenant?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface DeferredPasswordChangeResponse {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: true;
  passwordChangeDeferred: true;
}

export interface TeamAccount {
  id: string;
  email: string;
  fullName: string;
  status: 'ACTIVE' | 'PENDING_VERIFICATION' | 'DISABLED' | 'LOCKED';
  roles: string[];
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  updatedAt: string;
  mustChangePassword: boolean;
  avatarUrl?: string | null;
}

export const authApi = {
  login: (data: any) => {
    return apiClient.post<LoginResponse>('/auth/login', data);
  },
  
  // Future refresh token method
  refresh: (data: { refreshToken: string }) => {
    return apiClient.post<Pick<LoginResponse, 'accessToken' | 'refreshToken'>>('/auth/refresh', data);
  },
  
  register: (data: any) => {
    return apiClient.post<LoginResponse>('/auth/register', data);
  },

  forgotPassword: (data: any) => {
    return apiClient.post<{ success: boolean }>('/auth/forgot-password', data);
  },

  resetPassword: (data: any) => {
    return apiClient.post<{ success: boolean }>('/auth/reset-password', data);
  },

  changePassword: (data: { oldPassword: string; newPassword: string; confirmPassword: string }) => {
    return apiClient.post<{ success: boolean }>('/auth/change-password', data);
  },

  deferPasswordChange: () => {
    return apiClient.post<DeferredPasswordChangeResponse>('/auth/defer-password-change');
  },

  updateMe: (data: { fullName?: string }) => {
    return apiClient.patch<CurrentUserProfile>('/auth/me', data);
  },

  me: () => {
    return apiClient.get<CurrentUserProfile>('/auth/me');
  },

  team: () => {
    return apiClient.get<TeamAccount[]>('/auth/team');
  },

  createTeamMember: (data: { fullName: string; email: string; role: 'ADMIN' | 'MANAGER' | 'SALES' | 'FINANCE'; temporaryPassword: string }) => {
    return apiClient.post<TeamAccount>('/auth/team', data);
  },

  updateTeamMember: (
    id: string,
    data: {
      fullName?: string;
      role?: 'ADMIN' | 'MANAGER' | 'SALES' | 'FINANCE';
      status?: 'ACTIVE' | 'PENDING_VERIFICATION' | 'DISABLED' | 'LOCKED';
      temporaryPassword?: string;
      avatarUrl?: string;
    },
  ) => {
    return apiClient.patch<TeamAccount>(`/auth/team/${id}`, data);
  },
};
