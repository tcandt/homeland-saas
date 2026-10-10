import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { execSync } from 'child_process';
import { PDFDocument } from 'pdf-lib';
import dayjs from 'dayjs';
import { numberToWordsVietnamese } from '../../../lib/utils/number-to-words';
import { requireRoutePermission, getInternalApiBaseUrl } from '../../../lib/server/route-auth';
import { CompiledPdfAssetError, fetchCompiledPdfAsset, resolveCompiledPdfAssetUrl } from '../../../lib/server/compiled-pdf-assets';

const LANDLORDS: Record<string, any> = {
  TINH: {
    hoTenChuNha: "NGUYỄN ĐỨC TÍNH",
    ngaySinhChuNha: "13/03/1997",
    cccdChuNha: "054097010677",
    diaChiChuNha: "LK01.31 Khu đô thị Ân Phú , phường Tân An , tỉnh Đắk Lắk",
    dienThoaiChuNha: "0373129295 - 0567867889 ( Tính )",
    chuTaiKhoan: "HKD NGUYEN DUC TINH",
    soTaiKhoan: "8818406081",
    nganHang: "BIDV",
  },
  THE: {
    hoTenChuNha: "PHAN VĂN THỂ",
    ngaySinhChuNha: "24/11/1994",
    cccdChuNha: "066094006596 , Cấp ngày: 15/10/2025 tại Cục cảnh sát",
    diaChiChuNha: "LK01.31 Khu đô thị Ân Phú , phường Tân An , tỉnh Đắk Lắk",
    dienThoaiChuNha: "0373129295 - 0567.79.2222 ( Thể )",
    chuTaiKhoan: "HKD PHAN VAN THE",
    soTaiKhoan: "8827905414",
    nganHang: "BIDV",
  },
};

function resolveTaiLieuPath(filename: string): string {
  const candidates = [
    path.join(process.cwd(), 'tai-lieu', filename),
    path.join(process.cwd(), '..', 'tai-lieu', filename),
    path.join(process.cwd(), '..', '..', 'tai-lieu', filename),
    path.join('/app', 'tai-lieu', filename),
    path.join('/app', 'apps', 'web', 'tai-lieu', filename),
    path.join(process.cwd(), 'apps', 'web', 'tai-lieu', filename),
    path.resolve('tai-lieu', filename),
    path.join('d:\\homeland-new\\homeland-saas\\tai-lieu', filename),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function normalizeLookup(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase();
}

function isLk0131OrLk0132(value: unknown): boolean {
  const source = normalizeLookup(value).replace(/[^A-Z0-9]/g, '');
  return source.includes('LK0131') || source.includes('LK0132');
}

function isTwoBedroomIdentifier(value: unknown): boolean {
  const source = normalizeLookup(value).replace(/\s+/g, '');
  return source.includes('2PN') || source.includes('2PHONGNGU');
}

function resolveContractRoomType(contract: any): string {
  return (
    contract?.soPhongNgu ||
    contract?.roomType ||
    contract?.room?.roomType ||
    contract?.room?.type ||
    ''
  );
}

function shouldUseTwoBedroomTemplate(contract: any): boolean {
  if (!isTwoBedroomIdentifier(resolveContractRoomType(contract))) return false;

  return (
    isLk0131OrLk0132(contract?.toaNha) ||
    isLk0131OrLk0132(contract?.buildingName) ||
    isLk0131OrLk0132(contract?.buildingCode) ||
    isLk0131OrLk0132(contract?.room?.building?.code) ||
    isLk0131OrLk0132(contract?.room?.building?.name) ||
    isLk0131OrLk0132(contract?.room?.code) ||
    isLk0131OrLk0132(contract?.room?.name)
  );
}

function convertDocxToPdf(inputPath: string, outputPath: string) {
  const resolvedInput = path.resolve(inputPath);
  const resolvedOutput = path.resolve(outputPath);

  if (fs.existsSync(resolvedOutput)) {
    try {
      fs.unlinkSync(resolvedOutput);
    } catch (e) {
      // Ignore
    }
  }

  if (process.platform === 'win32') {
    const psScript = `
$word = New-Object -ComObject Word.Application;
$word.Visible = $false;
try {
  $doc = $word.Documents.Open('${resolvedInput.replace(/\\/g, '\\\\')}');
  $doc.SaveAs('${resolvedOutput.replace(/\\/g, '\\\\')}', 17);
  $doc.Close();
} finally {
  $word.Quit();
}
`;
    try {
      execSync(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`, { stdio: 'pipe' });
      return;
    } catch (e) {
      console.warn('Word COM conversion failed on Windows:', e);
    }
  }

  // Linux / Docker environment: try libreoffice or soffice
  try {
    const outDir = path.dirname(resolvedOutput);
    execSync(`libreoffice --headless --convert-to pdf "${resolvedInput}" --outdir "${outDir}"`, { stdio: 'pipe' });
    const autoPdf = path.join(outDir, `${path.basename(resolvedInput, path.extname(resolvedInput))}.pdf`);
    if (fs.existsSync(autoPdf) && autoPdf !== resolvedOutput) {
      fs.renameSync(autoPdf, resolvedOutput);
    }
  } catch {
    try {
      const outDir = path.dirname(resolvedOutput);
      execSync(`soffice --headless --convert-to pdf "${resolvedInput}" --outdir "${outDir}"`, { stdio: 'pipe' });
      const autoPdf = path.join(outDir, `${path.basename(resolvedInput, path.extname(resolvedInput))}.pdf`);
      if (fs.existsSync(autoPdf) && autoPdf !== resolvedOutput) {
        fs.renameSync(autoPdf, resolvedOutput);
      }
    } catch (err2) {
      console.warn('Docx to PDF conversion command not available or failed:', err2);
    }
  }
}

async function addImagePage(pdfDoc: PDFDocument, imgBuffer: Buffer, isPng: boolean) {
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 Portrait

  let img;
  try {
    if (isPng) {
      img = await pdfDoc.embedPng(imgBuffer);
    } else {
      img = await pdfDoc.embedJpg(imgBuffer);
    }
  } catch (err) {
    try {
      if (isPng) {
        img = await pdfDoc.embedJpg(imgBuffer);
      } else {
        img = await pdfDoc.embedPng(imgBuffer);
      }
    } catch (err2) {
      pdfDoc.removePage(pdfDoc.getPageCount() - 1);
      throw new CompiledPdfAssetError('INVALID_IMAGE', 'Ảnh tài liệu đính kèm bị hỏng');
    }
  }

  const isLandscape = img.width > img.height;
  if (isLandscape) {
    page.setSize(841.89, 595.28); // Landscape A4
  }

  const { width, height } = page.getSize();
  const margin = 20;
  const imgDims = img.scaleToFit(width - margin * 2, height - margin * 2);

  page.drawImage(img, {
    x: (width - imgDims.width) / 2,
    y: (height - imgDims.height) / 2,
    width: imgDims.width,
    height: imgDims.height,
  });
}

function calculateRentalDuration(startDateStr?: string | null, endDateStr?: string | null): string {
  if (!startDateStr || !endDateStr) return '..........................';
  const start = dayjs(startDateStr);
  const end = dayjs(endDateStr);
  const totalMonths = Math.round(end.diff(start, 'month', true));
  
  if (totalMonths === 12) return '01 năm';
  if (totalMonths === 24) return '02 năm';
  if (totalMonths === 36) return '03 năm';
  
  return `${totalMonths} tháng`;
}

async function fetchAssetBuffer(assetUrl: string, apiBaseUrl: string, authHeader?: string | null) {
  return fetchCompiledPdfAsset(assetUrl, apiBaseUrl, authHeader);
}

export async function POST(request: Request) {
  const tempFiles: string[] = [];
  let tempDir: string | undefined;
  try {
    const auth = await requireRoutePermission(request, 'contract.read');
    if ('response' in auth) return auth.response;

    const data = await request.json();
    const { contractId, ct01Draft = {} } = data;

    if (typeof contractId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(contractId)) {
      return NextResponse.json({ error: 'Missing contractId' }, { status: 400 });
    }

    const authHeader = auth.authorization;
    const apiBaseUrl = getInternalApiBaseUrl();

    // 1. Fetch Contract Details from the NestJS Backend API
    const contractRes = await fetch(`${apiBaseUrl}/contracts/${encodeURIComponent(contractId)}`, {
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      redirect: 'error',
      cache: 'no-store',
    });

    if (!contractRes.ok) {
      return NextResponse.json({ error: 'Không thể tải thông tin hợp đồng' }, { status: contractRes.status });
    }

    const resJson = await contractRes.json();
    const contract = resJson.data;

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Prepare temp folder inside os temp
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'homeland-pdf-'));
    const nowTimestamp = Date.now().toString(36);

    const idImages = contract.customer?.idImages || [];
    const canonicalIdImages = Array.isArray(idImages) ? idImages.map((ref: unknown) => resolveCompiledPdfAssetUrl(ref, apiBaseUrl)) : [];
    if (!Array.isArray(idImages) || idImages.length !== 2 || idImages.some((ref: unknown) => typeof ref !== 'string' || !ref) || new Set(canonicalIdImages).size !== 2) {
      throw new CompiledPdfAssetError('CCCD_IMAGES_REQUIRED', 'Hồ sơ phải có đúng hai ảnh CCCD khác nhau');
    }
    for (const [filename, label] of [['Giay-phep-KD.jpg', 'giấy đăng ký kinh doanh'], ['so-do-MT.jpg', 'sổ đỏ mặt trước'], ['so-do-MS.jpg', 'sổ đỏ mặt sau']] as const) {
      if (!fs.existsSync(resolveTaiLieuPath(filename))) {
        throw new CompiledPdfAssetError('STATIC_ASSET_MISSING', `Thiếu ${label}`);
      }
    }

    // 2. Generate CT01 PDF
    const ct01TemplatePath = resolveTaiLieuPath('CT01.docx');
    if (!fs.existsSync(ct01TemplatePath)) {
      return NextResponse.json({ error: 'Không tìm thấy file mẫu CT01' }, { status: 404 });
    }

    const ct01Content = fs.readFileSync(ct01TemplatePath);
    const ct01Zip = new PizZip(ct01Content);
    const ct01Doc = new Docxtemplater(ct01Zip, { paragraphLoop: true, linebreaks: true });

    // Split tenant birth date
    const tBirthDate = contract.customer?.birthDate ? dayjs(contract.customer.birthDate) : null;
    const ngaySinh = tBirthDate ? tBirthDate.format('DD') : '....';
    const thangSinh = tBirthDate ? tBirthDate.format('MM') : '....';
    const namSinh = tBirthDate ? tBirthDate.format('YYYY') : '......';

    // Contract / signed date
    const signDate = contract.signedAt ? dayjs(contract.signedAt) : null;
    const ngayHD = signDate ? signDate.format('DD') : '....';
    const thangHD = signDate ? signDate.format('MM') : '....';
    const namHD = signDate ? signDate.format('YYYY') : '......';

    // Get roommates / co-representatives
    const members = ct01Draft.thanhVien || contract.coRepresentatives?.map((rep: any) => ({
      name: rep.fullName || rep.name || '',
      birthDate: rep.birthDate || '',
      gender: rep.gender || '',
      cccd: rep.identityNo || '',
      relationship: rep.relationship || 'Khác',
    })) || [];

    const firstMember = members[0] || {};
    const hoTen2 = firstMember.name || '';
    const ngaySinh2 = firstMember.birthDate ? dayjs(firstMember.birthDate).format('DD/MM/YYYY') : '';
    const gioiTinh2 = firstMember.gender || '';
    const cccd2 = firstMember.cccd || '';
    const moiquanhe = firstMember.relationship || '';

    const roomAddress = contract.room?.building?.address || '';

    const cleanCccd = (cccdStr: string): string => {
      if (!cccdStr) return '';
      const match = cccdStr.match(/\d{12}/);
      if (match) return match[0];
      const digits = cccdStr.replace(/\D/g, '');
      return digits.substring(0, 12);
    };

    const tenantCccd = cleanCccd(contract.customer?.identityNo || contract.customer?.citizenId || '');
    const landlordCccd = cleanCccd(LANDLORDS[contract.chuNha || 'TINH']?.cccdChuNha || LANDLORDS['TINH']?.cccdChuNha || '');

    const ct01TemplateData = {
      hoTen: contract.customer?.fullName || contract.customer?.name || '',
      ngaySinh,
      thangSinh,
      namSinh,
      gioiTinh: contract.customer?.gender || '',
      dienThoai: contract.customer?.phone || '',
      diaChiChuNha: roomAddress,
      hoTen2,
      ngaySinh2,
      gioiTinh2,
      cccd2,
      moiquanhe,
      ngayHD,
      thangHD,
      namHD,
      // Map tenant's CCCD digits to c0..c11 (section 4)
      c0: tenantCccd[0] || '',
      c1: tenantCccd[1] || '',
      c2: tenantCccd[2] || '',
      c3: tenantCccd[3] || '',
      c4: tenantCccd[4] || '',
      c5: tenantCccd[5] || '',
      c6: tenantCccd[6] || '',
      c7: tenantCccd[7] || '',
      c8: tenantCccd[8] || '',
      c9: tenantCccd[9] || '',
      c10: tenantCccd[10] || '',
      c11: tenantCccd[11] || '',
      // Map landlord's CCCD digits to ch0..ch11 (section 9)
      ch0: landlordCccd[0] || '',
      ch1: landlordCccd[1] || '',
      ch2: landlordCccd[2] || '',
      ch3: landlordCccd[3] || '',
      ch4: landlordCccd[4] || '',
      ch5: landlordCccd[5] || '',
      ch6: landlordCccd[6] || '',
      ch7: landlordCccd[7] || '',
      ch8: landlordCccd[8] || '',
      ch9: landlordCccd[9] || '',
      ch10: landlordCccd[10] || '',
      ch11: landlordCccd[11] || '',
    };

    ct01Doc.render(ct01TemplateData);
    const ct01Buf = ct01Doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    const tempCt01Docx = path.join(tempDir, `ct01_${nowTimestamp}.docx`);
    const tempCt01Pdf = path.join(tempDir, `ct01_${nowTimestamp}.pdf`);
    
    fs.writeFileSync(tempCt01Docx, ct01Buf);
    tempFiles.push(tempCt01Docx);
    
    convertDocxToPdf(tempCt01Docx, tempCt01Pdf);
    tempFiles.push(tempCt01Pdf);
    if (!fs.existsSync(tempCt01Pdf) || fs.statSync(tempCt01Pdf).size === 0) {
      throw new CompiledPdfAssetError('CT01_CONVERSION_FAILED', 'Không thể tạo bản PDF CT01');
    }

    // 3. Obtain or Generate Lease Contract PDF
    const tempContractPdf = path.join(tempDir, `contract_${nowTimestamp}.pdf`);
    const docxAttachment = contract.attachments?.find((url: string) => typeof url === 'string' && /\.docx(\?|$)/i.test(url));
    const contractPdfDirect = contract.contractPdfUrl || contract.pdfUrl;
    const pdfAttachment = contract.attachments?.find((url: string) => typeof url === 'string' && /\.pdf(\?|$)/i.test(url)) || contractPdfDirect;
    let hasContractPdf = false;

    if (pdfAttachment) {
      const pdfBuffer = await fetchAssetBuffer(pdfAttachment, apiBaseUrl, authHeader);
      fs.writeFileSync(tempContractPdf, pdfBuffer);
      tempFiles.push(tempContractPdf);
      hasContractPdf = true;
    }

    if (!hasContractPdf && docxAttachment) {
      const attachmentBuffer = await fetchAssetBuffer(docxAttachment, apiBaseUrl, authHeader);
      const tempAttachmentDocx = path.join(tempDir, `attached_contract_${nowTimestamp}.docx`);
      fs.writeFileSync(tempAttachmentDocx, attachmentBuffer);
      tempFiles.push(tempAttachmentDocx);
      convertDocxToPdf(tempAttachmentDocx, tempContractPdf);
      if (!fs.existsSync(tempContractPdf) || fs.statSync(tempContractPdf).size === 0) {
        throw new CompiledPdfAssetError('CONTRACT_CONVERSION_FAILED', 'Không thể tạo PDF hợp đồng đính kèm');
      }
      tempFiles.push(tempContractPdf);
      hasContractPdf = true;
    }

    if (!hasContractPdf && contract.signedAt) {
      throw new CompiledPdfAssetError('SIGNED_CONTRACT_MISSING', 'Không thể tải hợp đồng đã ký');
    }

    if (!hasContractPdf) {
      const contractTemplateFilename = shouldUseTwoBedroomTemplate(contract)
        ? 'HOP_DONG_2PN.docx'
        : 'HOP_DONG_1PN.docx';
      const contractTemplatePath = resolveTaiLieuPath(contractTemplateFilename);
      if (!fs.existsSync(contractTemplatePath)) {
        return NextResponse.json({ error: `Không tìm thấy file mẫu hợp đồng ${contractTemplateFilename}` }, { status: 404 });
      }

      const landlordInfo = LANDLORDS[contract.chuNha || 'TINH'] || LANDLORDS['TINH'];
      const contractContent = fs.readFileSync(contractTemplatePath);
      const contractZip = new PizZip(contractContent);
      const contractDoc = new Docxtemplater(contractZip, { paragraphLoop: true, linebreaks: true });

      const contractTemplateData = {
        hoTen: contract.customer?.fullName || contract.customer?.name || '..........................',
        ngaySinh: contract.customer?.birthDate ? dayjs(contract.customer.birthDate).format('DD/MM/YYYY') : '..........................',
        cccd: contract.customer?.identityNo || contract.customer?.citizenId || '..........................',
        diaChi: contract.customer?.address || '..........................',
        dienThoai: contract.customer?.phone || '..........................',
        dienThoaiNguoithan: contract.customer?.emergencyPhone || '',
        ngayKyHD: contract.signedAt ? dayjs(contract.signedAt).format('DD') : '...',
        thangKyHD: contract.signedAt ? dayjs(contract.signedAt).format('MM') : '...',
        namKyHD: contract.signedAt ? dayjs(contract.signedAt).format('YYYY') : '....',
        ngayKyhopdong: contract.signedAt ? dayjs(contract.signedAt).format('DD/MM/YYYY') : '..........................',
        ngayThanhToanDauTien: contract.firstPaymentDate ? dayjs(contract.firstPaymentDate).format('DD/MM/YYYY') : '..........................',
        mucDichThue: contract.purpose || 'Để ở',
        tienThue: Number(contract.monthlyRent) || 0,
        tienThueChu: contract.monthlyRent ? numberToWordsVietnamese(Number(contract.monthlyRent)) : '..........................',
        tienCoc: Number(contract.depositMoney) || 0,
        tienCocChu: contract.depositMoney ? numberToWordsVietnamese(Number(contract.depositMoney)) : '..........................',
        ngayBatDau: contract.startDate ? dayjs(contract.startDate).format('DD/MM/YYYY') : '..........................',
        ngayKetThuc: contract.endDate ? dayjs(contract.endDate).format('DD/MM/YYYY') : '..........................',
        ngayKetthuc: contract.endDate ? dayjs(contract.endDate).format('DD/MM/YYYY') : '..........................',
        maPhong: contract.room?.code || contract.room?.name || '..........................',
        soPhongNgu: resolveContractRoomType(contract) || '1 phòng ngủ',
        thoiHanThue: calculateRentalDuration(contract.startDate, contract.endDate),
        Hanthue: calculateRentalDuration(contract.startDate, contract.endDate),
        chuNha: contract.chuNha || 'TINH',
        toaNha: contract.room?.building?.name || '..........................',
        diachiToanha: contract.room?.building?.address || '..........................',
        quanLyToaNha: contract.quanLyToaNha || contract.dienThoaiQuanLy || '0373.129.295 Nhân',
        ...landlordInfo,
      };

      contractDoc.render(contractTemplateData);
      const contractBuf = contractDoc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
      const tempContractDocx = path.join(tempDir, `contract_${nowTimestamp}.docx`);

      fs.writeFileSync(tempContractDocx, contractBuf);
      tempFiles.push(tempContractDocx);

      convertDocxToPdf(tempContractDocx, tempContractPdf);
      tempFiles.push(tempContractPdf);
    }

    // 4. Create merged PDF document using pdf-lib
    const mergedPdf = await PDFDocument.create();

    // -- Order --
    // 1. Mặt trước CCCD
    // 2. Mặt sau CCCD
    // 3. Tờ khai CT01
    // 4. Hợp đồng thuê căn hộ
    // 5. Giấy đăng ký kinh doanh
    // 6. SỔ ĐỎ (mặt trước)
    // 7. SỔ ĐỎ (mặt sau)

    // CCCD Images (from contract.customer.idImages)
    // Front CCCD
    const frontBuf = await fetchAssetBuffer(idImages[0], apiBaseUrl, authHeader);
    await addImagePage(mergedPdf, frontBuf, idImages[0].toLowerCase().includes('.png'));

    // Back CCCD
    const backBuf = await fetchAssetBuffer(idImages[1], apiBaseUrl, authHeader);
    await addImagePage(mergedPdf, backBuf, idImages[1].toLowerCase().includes('.png'));

    // CT01 PDF pages
    let ct01PdfDoc: PDFDocument;
    try {
      ct01PdfDoc = await PDFDocument.load(fs.readFileSync(tempCt01Pdf));
    } catch {
      throw new CompiledPdfAssetError('CT01_INVALID', 'Bản PDF CT01 không hợp lệ');
    }
    const pages = await mergedPdf.copyPages(ct01PdfDoc, ct01PdfDoc.getPageIndices());
    if (!pages.length) throw new CompiledPdfAssetError('CT01_EMPTY', 'Bản PDF CT01 không có trang');
    pages.forEach(p => mergedPdf.addPage(p));

    // Contract PDF pages
    let contractPdfDoc: PDFDocument;
    try {
      contractPdfDoc = await PDFDocument.load(fs.readFileSync(tempContractPdf));
    } catch {
      throw new CompiledPdfAssetError('CONTRACT_INVALID', 'Bản PDF hợp đồng không hợp lệ');
    }
    const contractPages = await mergedPdf.copyPages(contractPdfDoc, contractPdfDoc.getPageIndices());
    if (!contractPages.length) throw new CompiledPdfAssetError('CONTRACT_EMPTY', 'Bản PDF hợp đồng không có trang');
    contractPages.forEach(p => mergedPdf.addPage(p));

    // Giấy đăng ký kinh doanh
    const gpkdPath = resolveTaiLieuPath('Giay-phep-KD.jpg');
    if (!fs.existsSync(gpkdPath)) throw new CompiledPdfAssetError('STATIC_ASSET_MISSING', 'Thiếu giấy đăng ký kinh doanh');
    await addImagePage(mergedPdf, fs.readFileSync(gpkdPath), false);

    // Sổ đỏ mặt trước
    const sodoMTPath = resolveTaiLieuPath('so-do-MT.jpg');
    if (!fs.existsSync(sodoMTPath)) throw new CompiledPdfAssetError('STATIC_ASSET_MISSING', 'Thiếu sổ đỏ mặt trước');
    await addImagePage(mergedPdf, fs.readFileSync(sodoMTPath), false);

    // Sổ đỏ mặt sau
    const sodoMSPath = resolveTaiLieuPath('so-do-MS.jpg');
    if (!fs.existsSync(sodoMSPath)) throw new CompiledPdfAssetError('STATIC_ASSET_MISSING', 'Thiếu sổ đỏ mặt sau');
    await addImagePage(mergedPdf, fs.readFileSync(sodoMSPath), false);

    if (mergedPdf.getPageCount() === 0) {
      return NextResponse.json({ error: 'Không có nội dung nào để tạo tài liệu PDF' }, { status: 400 });
    }

    // Serialize merged PDF
    const finalPdfBytes = await mergedPdf.save();

    return new NextResponse(finalPdfBytes as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="HoSoLuuTru_Phong_${contract.room?.code || 'Detail'}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });

  } catch (error: any) {
    if (error instanceof CompiledPdfAssetError) {
      return NextResponse.json({ error: error.label, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: 'Không thể đóng gói PDF' }, { status: 500 });
  } finally {
    // Clean up temporary files
    for (const file of tempFiles) {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch (e) {
          console.error(`Failed to delete temp file ${file}:`, e);
        }
      }
    }
    if (tempDir && fs.existsSync(tempDir)) {
      try { fs.rmdirSync(tempDir); } catch { /* best effort */ }
    }
  }
}
