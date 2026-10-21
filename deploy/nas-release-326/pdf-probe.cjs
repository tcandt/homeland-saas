const fs = require('node:fs');
const a = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const PizZip = require('/app/node_modules/pizzip');
const Docxtemplater = require('/app/node_modules/docxtemplater');

async function main() {
  a.equal(process.env.APP_VERSION, '3.2.6');
  const { resolvePreviewBirthDate } = await import('/release/context/apps/web/lib/contracts/contract-birth-date.ts');
  const birth = resolvePreviewBirthDate({ ngaySinh: '..........................', customer: { id: 'probe', birthDate: '13/02/1999' } });
  a.equal(birth.display, '13/02/1999');
  for (const rooms of [1, 2]) {
    const filename = `HOP_DONG_${rooms}PN.docx`;
    const doc = new Docxtemplater(new PizZip(fs.readFileSync(`/app/tai-lieu/${filename}`)), {
      paragraphLoop: true, linebreaks: true, nullGetter: () => '',
    });
    doc.render({
      hoTen: 'KHACH THU NGHIEM NGAY SINH', ngaySinh: birth.display,
      cccd: '000000000001', diaChi: 'DIA CHI THU NGHIEM', dienThoai: '0900000000',
      hoTenChuNha: 'CHU NHA THU NGHIEM', ngaySinhChuNha: '01/01/1990',
      cccdChuNha: '000000000002', diaChiChuNha: 'DIA CHI THU NGHIEM', dienThoaiChuNha: '0900000001',
      maPhong: 'PN TEST', soPhongNgu: `${rooms} phong ngu`, mucDichThue: 'De o',
      tienThue: '1.000.000', tienCoc: '1.000.000', ngayBatDau: '01/11/2026', ngayKetThuc: '01/11/2027',
    });
    const base = `/tmp/dob-probe-${rooms}pn`;
    fs.writeFileSync(`${base}.docx`, doc.getZip().generate({ type: 'nodebuffer' }));
    execFileSync('libreoffice', ['-env:UserInstallation=file:///tmp/homeland-dob-probe', '--headless', '--convert-to', 'pdf', '--outdir', '/tmp', `${base}.docx`], { stdio: 'pipe', timeout: 90000 });
    a.ok(fs.statSync(`${base}.pdf`).size > 1000);
    fs.copyFileSync(`${base}.pdf`, `/fixtures/dob-probe-${rooms}pn.pdf`);
  }
  console.log(JSON.stringify({ status: 'PASS', version: process.env.APP_VERSION, commit: process.env.COMMIT_SHA, templates: 2, birthDate: birth.display, providerCalls: 0 }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
