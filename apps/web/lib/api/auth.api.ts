import { apiClient } from './client';

export interface User {
  id: string;
  email: string;
  fullName: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
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
  }
};
