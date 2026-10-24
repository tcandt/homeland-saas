import { ArgumentsHost } from '@nestjs/common';
import { describe, it, expect, vi } from 'vitest';
import { ClsService } from 'nestjs-cls';
import { ZodValidationException, ZodValidationPipe } from 'nestjs-zod';
import { ChatRequestDto, ChatRequestSchema } from './chat.dto';
import { GlobalExceptionFilter } from '../../shared/exceptions/global-exception.filter';

describe('Zod major upgrade HTTP compatibility', () => {
  const pipe = new ZodValidationPipe();
  const validate = (value: unknown) => pipe.transform(value, { type: 'body', metatype: ChatRequestDto });

  it('applies defaults and trimming through the actual DTO validation pipe', () => {
    expect(validate({ messages: [{ content: ' hello ' }] })).toEqual({
      messages: [{ role: 'user', content: 'hello' }],
    });
  });

  it.each([
    { messages: [] },
    { messages: [{ role: 'system', content: 'hello' }] },
    { messages: [{ content: ' ' }] },
    { messages: [{ content: 'x'.repeat(20_001) }] },
    { messages: [{ content: 'hello', unexpected: true }] },
    { messages: [{ content: 'hello' }], options: { unexpected: true } },
    { messages: [{ content: 'hello' }], unexpected: true },
  ])('rejects invalid or extra fields: %j', value => {
    expect(() => validate(value)).toThrow(ZodValidationException);
  });

  it.each(['pipe', 'direct'])('preserves issue details in the %s error response', source => {
    let exception: unknown;
    try {
      if (source === 'pipe') validate({ messages: [] });
      else ChatRequestSchema.parse({ messages: [] });
    } catch (error) { exception = error; }
    expect(exception).toBeDefined();
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = { switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/api/ai/chat' }),
    }) } as unknown as ArgumentsHost;
    const filter = new GlobalExceptionFilter({ getId: () => 'compat-test' } as unknown as ClsService);
    filter.catch(exception, host);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      requestId: 'compat-test',
      error: expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: expect.arrayContaining([expect.objectContaining({ path: ['messages'] })]),
      }),
    }));
  });
});
