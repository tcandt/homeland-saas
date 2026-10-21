import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/** Keep the two identity tables aligned without changing contractual text or tags. */
export function normalizeContractIdentityTables(xml: string): string {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const elements = (parent: Element, name: string) =>
    Array.from(parent.getElementsByTagNameNS(WORD_NS, name));
  const child = (parent: Element, name: string) => {
    let found = Array.from(parent.childNodes).find((node) => node.nodeType === 1 &&
      (node as Element).namespaceURI === WORD_NS && (node as Element).localName === name) as Element | undefined;
    if (!found) {
      found = document.createElementNS(WORD_NS, `w:${name}`) as unknown as Element;
      if (name === 'vAlign') parent.appendChild(found);
      else parent.insertBefore(found, parent.firstChild);
    }
    return found;
  };
  const attr = (element: Element, name: string, value: string) => element.setAttributeNS(WORD_NS, `w:${name}`, value);
  for (const table of Array.from(document.getElementsByTagNameNS(WORD_NS, 'tbl'))) {
    const text = elements(table as unknown as Element, 't').map((node) => node.textContent).join('');
    if (!text.includes('CCCD/CC/Hộ chiếu') || !/\{(?:hoTen|hoTenChuNha)\}/.test(text)) continue;
    const columns = elements(table as unknown as Element, 'gridCol');
    if (columns.length !== 2) continue;
    const totalWidth = columns.reduce((sum, col) => sum + Number(col.getAttributeNS(WORD_NS, 'w')), 0);
    if (!Number.isFinite(totalWidth) || totalWidth <= 0) continue;
    const widths = [Math.round(totalWidth * 0.35), totalWidth - Math.round(totalWidth * 0.35)];
    columns.forEach((column, index) => attr(column, 'w', String(widths[index])));
    for (const row of elements(table as unknown as Element, 'tr')) {
      const cells = Array.from(row.childNodes).filter((node) => node.nodeType === 1 &&
        (node as Element).localName === 'tc') as Element[];
      if (cells.length !== 2) continue;
      cells.forEach((cell, index) => {
        const props = child(cell, 'tcPr');
        const width = child(props, 'tcW');
        attr(width, 'w', String(widths[index]));
        attr(width, 'type', 'dxa');
        attr(child(props, 'vAlign'), 'val', 'center');
        for (const paragraph of elements(cell, 'p')) {
          const spacing = child(child(paragraph, 'pPr'), 'spacing');
          attr(spacing, 'before', '60');
          attr(spacing, 'after', '60');
          attr(spacing, 'line', '276');
          attr(spacing, 'lineRule', 'auto');
        }
      });
    }
  }
  return new XMLSerializer().serializeToString(document);
}
