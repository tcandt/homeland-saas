import * as Handlebars from 'handlebars';

const VARIABLE_PATH_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/;

function hasOwn(source: unknown, key: string) {
  return Boolean(source && typeof source === 'object' && Object.prototype.hasOwnProperty.call(source, key));
}

export class TemplateEngine {
  constructor() {
    this.registerHelpers();
  }

  private registerHelpers() {
    Handlebars.registerHelper('formatDate', (dateStr, format) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      // Simplistic formatter, assume DD/MM/YYYY for sprint
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    });

    Handlebars.registerHelper('formatDateTime', (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });

    Handlebars.registerHelper('formatCurrency', (amount, currency = 'VND') => {
      if (!amount) return '0';
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(amount);
    });

    Handlebars.registerHelper('formatNumber', (amount) => {
      if (!amount) return '0';
      return new Intl.NumberFormat('vi-VN').format(amount);
    });

    Handlebars.registerHelper('daysDiff', (dateStr, nowStr) => {
      if (!dateStr) return 0;
      const end = new Date(dateStr).getTime();
      const start = nowStr === 'now' ? Date.now() : new Date(nowStr).getTime();
      return Math.floor((start - end) / (1000 * 3600 * 24));
    });

    Handlebars.registerHelper('default', (val, defaultVal) => {
      return val || defaultVal;
    });

    Handlebars.registerHelper('uppercase', (str) => {
      return str ? str.toUpperCase() : '';
    });

    Handlebars.registerHelper('lowercase', (str) => {
      return str ? str.toLowerCase() : '';
    });

    Handlebars.registerHelper('truncate', (str, length) => {
      if (!str) return '';
      return str.length > length ? str.substring(0, length) + '...' : str;
    });
  }

  private extractVariablePaths(templateString: string): string[] {
    try {
      Handlebars.parse(templateString);
    } catch {
      throw new Error('Mẫu tin có cú pháp Handlebars không hợp lệ.');
    }

    const tokens = templateString.match(/{{{?[\s\S]*?}?}}/g) || [];
    const variables = new Set<string>();
    for (const token of tokens) {
      const isRaw = token.startsWith('{{{') || token.endsWith('}}}');
      const expression = token.slice(isRaw ? 3 : 2, isRaw ? -3 : -2).trim();
      if (isRaw || !VARIABLE_PATH_PATTERN.test(expression)) {
        throw new Error(`Biểu thức ${token} không hỗ trợ. Chỉ dùng biến dạng {{customerName}} hoặc {{metadata.code}}.`);
      }
      variables.add(expression);
    }

    return [...variables];
  }

  validateTemplate(templateString: string, allowedVariables: string[]) {
    if (!templateString || !templateString.trim()) {
      throw new Error('Nội dung mẫu tin không được để trống.');
    }
    const variables = this.extractVariablePaths(templateString);
    const allowed = new Set(allowedVariables);
    for (const variable of variables) {
      if (!allowed.has(variable)) {
        throw new Error(`Biến {{${variable}}} chưa được hỗ trợ cho sự kiện này.`);
      }
    }
    return variables;
  }

  compile(templateString: string, context: any): string {
    let variables: string[];
    try {
      variables = this.extractVariablePaths(templateString);
    } catch (error: any) {
      if (String(error?.message || '').includes('cú pháp')) throw error;

      // Historical tenant templates may use the small helper set registered above.
      // New drafts never reach this path because validateTemplate rejects helpers.
      return Handlebars.compile(templateString, { noEscape: true })(context);
    }
    for (const variable of variables) {
      const parts = variable.split('.');
      let current: any = context;
      for (const part of parts) {
        if (!hasOwn(current, part) || current[part] === undefined || current[part] === null) {
          throw new Error(`Thiếu dữ liệu cho biến {{${variable}}}.`);
        }
        current = current[part];
      }
    }

    // Providers apply their own channel-safe escaping. Keeping this text raw avoids
    // HTML entities appearing in Zalo and plain-text Telegram messages.
    const template = Handlebars.compile(templateString, { noEscape: true });
    return template(context);
  }
}
