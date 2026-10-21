import { readFileSync } from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';
import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';
import { normalizeContractIdentityTables } from './contract-table-layout';

const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
describe('contract identity table layout', () => {
  it.each(['HOP_DONG_1PN.docx', 'HOP_DONG_2PN.docx'])('preserves all text and aligns identity rows in %s', (name) => {
    const zip = new PizZip(readFileSync(path.resolve(process.cwd(), '../../tai-lieu', name)));
    const original = zip.file('word/document.xml')!.asText();
    const normalized = normalizeContractIdentityTables(original);
    const before = new DOMParser().parseFromString(original, 'application/xml');
    const after = new DOMParser().parseFromString(normalized, 'application/xml');
    const texts = (doc: typeof before) => Array.from(doc.getElementsByTagNameNS(ns, 't')).map((node) => node.textContent);
    expect(texts(after)).toEqual(texts(before));
    expect(normalizeContractIdentityTables(normalized)).toBe(normalized);
    const tables = Array.from(after.getElementsByTagNameNS(ns, 'tbl')).filter((table) =>
      table.textContent?.includes('CCCD/CC/Hộ chiếu') && /\{(?:hoTen|hoTenChuNha)\}/.test(table.textContent));
    expect(tables).toHaveLength(2);
    for (const table of tables) {
      const columns = Array.from(table.getElementsByTagNameNS(ns, 'gridCol')).map((column) => Number(column.getAttributeNS(ns, 'w')));
      expect(columns[0] / (columns[0] + columns[1])).toBeCloseTo(0.35, 3);
      expect(Array.from(table.getElementsByTagNameNS(ns, 'vAlign')).every((node) => node.getAttributeNS(ns, 'val') === 'center')).toBe(true);
    }
  });
});
