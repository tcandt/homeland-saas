const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const mod = { exports: {} };
const source = fs.readFileSync('apps/web/lib/server/contract-table-layout.ts', 'utf8');
new Function('require', 'module', 'exports', ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }))(require, mod, mod.exports);
const out = path.join(__dirname, 'pdf-fixtures');
fs.mkdirSync(out, { recursive: true });
for (const name of ['HOP_DONG_1PN', 'HOP_DONG_2PN']) {
  const zip = new PizZip(fs.readFileSync(`tai-lieu/${name}.docx`));
  zip.file('word/document.xml', mod.exports.normalizeContractIdentityTables(zip.file('word/document.xml').asText()));
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => '01' });
  doc.render({ hoTen: 'NGUY\u1ec4N TH\u1eca KH\u00c1CH THU\u00ca KI\u1ec2M TH\u1eec', hoTenChuNha: 'NGUY\u1ec4N V\u0102N CH\u1ee6 NH\u00c0',
    ngaySinh: '13/03/1997', ngaySinhChuNha: '13/03/1997', cccd: '054097010677', cccdChuNha: '054097010677',
    diaChi: 'LK01.31 Khu \u0111\u00f4 th\u1ecb \u00c2n Ph\u00fa, ph\u01b0\u1eddng T\u00e2n An, t\u1ec9nh \u0110\u1eafk L\u1eafk',
    diaChiChuNha: 'LK01.31 Khu \u0111\u00f4 th\u1ecb \u00c2n Ph\u00fa, ph\u01b0\u1eddng T\u00e2n An, t\u1ec9nh \u0110\u1eafk L\u1eafk' });
  fs.writeFileSync(path.join(out, `${name}.docx`), doc.getZip().generate({ type: 'nodebuffer' }));
}
console.log('Synthetic identity-table fixtures generated; no customer data');
