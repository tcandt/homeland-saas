interface LoginApiError {
  status?: number;
  code?: string;
  message?: string;
}

export function getLoginErrorMessage(error: LoginApiError) {
  if (error.code === 'AUTH_ACCOUNT_DISABLED') {
    return 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.';
  }

  if (error.code === 'AUTH_INVALID_CREDENTIALS' || error.status === 401) {
    return 'Tài khoản hoặc mật khẩu không chính xác.';
  }

  return error.message || 'Không thể đăng nhập. Vui lòng thử lại.';
}
