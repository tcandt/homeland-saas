import * as Handlebars from 'handlebars';

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

  compile(templateString: string, context: any): string {
    const template = Handlebars.compile(templateString);
    return template(context);
  }
}
