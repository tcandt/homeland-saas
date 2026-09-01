import { z } from 'zod';

export const LoginSchema = z.object({
  emailOrPhone: z.string().min(1, 'Email or Phone is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Old password is required'),
  newPassword: z.string().min(12, 'New password must be at least 12 characters'),
  confirmPassword: z.string().min(12, 'Confirm password is required'),
}).refine((data: any) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const RegisterSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone is required'),
  password: z.string().min(12, 'Password must be at least 12 characters'), // following password service strength
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(12, 'Password must be at least 12 characters'),
});

export const CreateTeamMemberSchema = z.object({
  fullName: z.string().trim().min(2, 'Họ và tên phải có ít nhất 2 ký tự'),
  email: z.string().trim().email('Email không đúng định dạng'),
  role: z.enum(['ADMIN', 'MANAGER', 'SALES', 'FINANCE']),
  temporaryPassword: z.string().min(6, 'Mật khẩu tạm phải có ít nhất 6 ký tự').optional(),
});

export const UpdateTeamMemberSchema = z.object({
  fullName: z.string().trim().min(2, 'Họ và tên phải có ít nhất 2 ký tự').optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'SALES', 'FINANCE']).optional(),
  status: z.enum(['ACTIVE', 'PENDING_VERIFICATION', 'DISABLED', 'LOCKED']).optional(),
  temporaryPassword: z.string().min(6, 'Mật khẩu tạm phải có ít nhất 6 ký tự').optional(),
  avatarUrl: z.string().trim().min(1).optional(),
}).refine((data) => Object.values(data).some((value) => value !== undefined), {
  message: 'Cần ít nhất một trường thông tin để cập nhật',
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type CreateTeamMemberInput = z.infer<typeof CreateTeamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof UpdateTeamMemberSchema>;
