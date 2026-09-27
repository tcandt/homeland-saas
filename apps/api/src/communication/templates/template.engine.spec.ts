import { describe, expect, it } from 'vitest';
import { TemplateEngine } from './template.engine';

describe('TemplateEngine', () => {
  const engine = new TemplateEngine();

  it('renders a supported variable without HTML entity substitution for a text channel', () => {
    expect(engine.compile('Xin chào {{customerName}}', { customerName: 'An & Bình' })).toBe('Xin chào An & Bình');
  });

  it('rejects unsupported expressions before a template is stored', () => {
    expect(() => engine.validateTemplate('{{unknownValue}}', ['customerName'])).toThrow('Biến {{unknownValue}} chưa được hỗ trợ');
    expect(() => engine.validateTemplate('{{{customerName}}}', ['customerName'])).toThrow('không hỗ trợ');
    expect(() => engine.validateTemplate('{{uppercase customerName}}', ['customerName'])).toThrow('không hỗ trợ');
  });

  it('rejects a render when a required context variable is absent', () => {
    expect(() => engine.compile('Mã hóa đơn {{metadata.code}}', { metadata: {} })).toThrow('Thiếu dữ liệu cho biến {{metadata.code}}');
  });
});
