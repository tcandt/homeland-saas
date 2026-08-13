import { ArgumentsHost } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GlobalExceptionFilter } from './global-exception.filter';

function createHost() {
  const status = vi.fn();
  const json = vi.fn();
  status.mockReturnValue({ json });
  const request = { method: 'GET', url: '/api/v1/dashboard' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe('GlobalExceptionFilter', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it('does not expose unexpected exception details in production', () => {
    process.env.NODE_ENV = 'production';
    const { host, json } = createHost();
    const filter = new GlobalExceptionFilter({ getId: () => 'request-1' } as any);
    vi.spyOn((filter as any).logger, 'error').mockImplementation(() => undefined);

    filter.catch(new Error('database password leaked'), host);

    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      requestId: 'request-1',
      error: expect.objectContaining({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      }),
    }));
  });

  it('returns readable Vietnamese for duplicate records', () => {
    const { host, status, json } = createHost();
    const filter = new GlobalExceptionFilter({ getId: () => 'request-2' } as any);

    filter.catch({ code: 'P2002', meta: { target: ['email'] } }, host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        code: 'RESOURCE_ALREADY_EXISTS',
        message: 'Dữ liệu đã tồn tại trong hệ thống (trùng trường: email). Vui lòng nhập giá trị khác.',
      }),
    }));
  });
});
