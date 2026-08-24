import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { execSync } from 'child_process';
import { PDFDocument } from 'pdf-lib';
import dayjs from 'dayjs';
import { numberToWordsVietnamese } from '@/lib/utils/number-to-words';

const LANDLORDS: Record<string, any> = {
  TINH: {
    hoTenChuNha: "NGUYỄN ĐỨC TÍNH",
    ngaySinhChuNha: "13/03/1997",
    cccdChuNha: "054097010677",
    diaChiChuNha: "LK01.31 Khu đô thị \u00c2n Phú , phường Tân An , tỉnh Đắk Lắk",
    dienThoaiChuNha: "0373129295 - 0567867889 ( Tính )",
    chuTaiKhoan: "HKD NGUYEN DUC TINH",
    soTaiKhoan: "8818406081",
    nganHang: "BIDV",
  },
  THE: {
    hoTenChuNha: "PHAN VĂN THỂ",
    ngaySinhChuNha: "24/11/1994",
    cccdChuNha: "066094006596 , Cấp ngày: 15/10/2025 tại Cục cảnh sát",
    diaChiChuNha: "LK01.31 Khu đô thị \u00c2n Phú , phường Tân An , tỉnh Đắk Lắk",
    dienThoaiChuNha: "0373129295 - 0567.79.2222 ( Thể )",
    chuTaiKhoan: "HKD PHAN VAN THE",
    soTaiKhoan: "8827905414",
    nganHang: "BIDV",
  }
};

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

  execSync(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`, { stdio: 'inherit' });
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
      console.error('Failed to embed image:', err2);
      // Remove the added page if we can't embed the image
      pdfDoc.removePage(pdfDoc.getPageCount() - 1);
      return;
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

function resolveAssetUrl(assetUrl: string, apiBaseUrl: string) {
  if (!assetUrl) return '';
  if (assetUrl.startsWith('http://') || assetUrl.startsWith('https://')) {
    return assetUrl;
  }
  const root = apiBaseUrl.replace(/\/api\/v1\/?$/, '');
  if (assetUrl.startsWith('/')) {
    return `${root}${assetUrl}`;
  }
  return `${root}/${assetUrl}`;
}

async function fetchAssetBuffer(assetUrl: string, apiBaseUrl: string, authHeader?: string | null) {
  const resolvedUrl = resolveAssetUrl(assetUrl, apiBaseUrl);
  if (!resolvedUrl) return null;
  const response = await fetch(resolvedUrl, {
    headers: {
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch asset: ${resolvedUrl} (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function POST(request: Request) {
  const tempFiles: string[] = [];
  try {
    const data = await request.json();
    const { contractId, ct01Draft = {} } = data;

    if (!contractId) {
      return NextResponse.json({ error: 'Missing contractId' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    let apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001/api/v1';
    if (!apiBaseUrl.startsWith('http')) {
      apiBaseUrl = 'http://127.0.0.1:3001/api/v1';
    }

    // 1. Fetch Contract Details from the NestJS Backend API
    const contractRes = await fetch(`${apiBaseUrl}/contracts/${contractId}`, {
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    if (!contractRes.ok) {
      const errText = await contractRes.text();
      return NextResponse.json({ error: `Failed to fetch contract from API: ${errText}` }, { status: contractRes.status });
    }

    const resJson = await contractRes.json();
    const contract = resJson.data;

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Prepare temp folder inside tai-lieu
    const tempDir = path.resolve('d:\\homeland-new\\homeland-saas\\tai-lieu\\temp_docx');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const nowTimestamp = Date.now();

    // 2. Generate CT01 PDF
    const ct01TemplatePath = 'd:\\homeland-new\\homeland-saas\\tai-lieu\\CT01.docx';
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
    const signDate = contract.signedAt ? dayjs(contract.signedAt) : dayjs();
    const ngayHD = signDate.format('DD');
    const thangHD = signDate.format('MM');
    const namHD = signDate.format('YYYY');

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

    // 3. Obtain or Generate Lease Contract PDF
    const tempContractPdf = path.join(tempDir, `contract_${nowTimestamp}.pdf`);
    const docxAttachment = contract.attachments?.find((url: string) => url.toLowerCase().endsWith('.docx'));
    let hasContractPdf = false;

    if (docxAttachment) {
      const attachmentBuffer = await fetchAssetBuffer(docxAttachment, apiBaseUrl, authHeader);
      if (attachmentBuffer) {
        const tempAttachmentDocx = path.join(tempDir, `attached_contract_${nowTimestamp}.docx`);
        fs.writeFileSync(tempAttachmentDocx, attachmentBuffer);
        tempFiles.push(tempAttachmentDocx);
        convertDocxToPdf(tempAttachmentDocx, tempContractPdf);
        tempFiles.push(tempContractPdf);
        hasContractPdf = true;
      }
    }

    if (!hasContractPdf) {
      const contractTemplatePath = 'd:\\homeland-new\\homeland-saas\\tai-lieu\\HOP_DONG_1PN.docx';
      if (!fs.existsSync(contractTemplatePath)) {
        return NextResponse.json({ error: 'Không tìm thấy file mẫu hợp đồng HOP_DONG_1PN.docx' }, { status: 404 });
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
        soPhongNgu: '1',
        thoiHanThue: calculateRentalDuration(contract.startDate, contract.endDate),
        Hanthue: calculateRentalDuration(contract.startDate, contract.endDate),
        chuNha: contract.chuNha || 'TINH',
        toaNha: contract.room?.building?.name || '..........................',
        diachiToanha: contract.room?.building?.address || '..........................',
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
    const idImages = contract.customer?.idImages || [];
    
    // Front CCCD
    if (idImages[0]) {
      const imgBuf = await fetchAssetBuffer(idImages[0], apiBaseUrl, authHeader);
      if (imgBuf) {
        const isPng = idImages[0].toLowerCase().includes('.png');
        await addImagePage(mergedPdf, imgBuf, isPng);
      }
    }

    // Back CCCD
    if (idImages[1]) {
      const imgBuf = await fetchAssetBuffer(idImages[1], apiBaseUrl, authHeader);
      if (imgBuf) {
        const isPng = idImages[1].toLowerCase().includes('.png');
        await addImagePage(mergedPdf, imgBuf, isPng);
      }
    }

    // CT01 PDF pages
    if (fs.existsSync(tempCt01Pdf)) {
      const ct01PdfDoc = await PDFDocument.load(fs.readFileSync(tempCt01Pdf));
      const pages = await mergedPdf.copyPages(ct01PdfDoc, ct01PdfDoc.getPageIndices());
      pages.forEach(p => mergedPdf.addPage(p));
    }

    // Contract PDF pages
    if (fs.existsSync(tempContractPdf)) {
      const contractPdfDoc = await PDFDocument.load(fs.readFileSync(tempContractPdf));
      const pages = await mergedPdf.copyPages(contractPdfDoc, contractPdfDoc.getPageIndices());
      pages.forEach(p => mergedPdf.addPage(p));
    }

    // Giấy đăng ký kinh doanh
    const gpkdPath = 'd:\\homeland-new\\homeland-saas\\tai-lieu\\Giay-phep-KD.jpg';
    if (fs.existsSync(gpkdPath)) {
      const imgBuf = fs.readFileSync(gpkdPath);
      await addImagePage(mergedPdf, imgBuf, false);
    }

    // Sổ đỏ mặt trước
    const sodoMTPath = 'd:\\homeland-new\\homeland-saas\\tai-lieu\\so-do-MT.jpg';
    if (fs.existsSync(sodoMTPath)) {
      const imgBuf = fs.readFileSync(sodoMTPath);
      await addImagePage(mergedPdf, imgBuf, false);
    }

    // Sổ đỏ mặt sau
    const sodoMSPath = 'd:\\homeland-new\\homeland-saas\\tai-lieu\\so-do-MS.jpg';
    if (fs.existsSync(sodoMSPath)) {
      const imgBuf = fs.readFileSync(sodoMSPath);
      await addImagePage(mergedPdf, imgBuf, false);
    }

    // Serialize merged PDF
    const finalPdfBytes = await mergedPdf.save();

    return new NextResponse(finalPdfBytes as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="HoSoLuuTru_Phong_${contract.room?.code || 'Detail'}.pdf"`,
      },
    });

  } catch (error: any) {
    console.error('Error compiling package PDF:', error);
    return NextResponse.json({ error: error?.message || 'Lỗi hệ thống khi đóng gói PDF' }, { status: 500 });
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
  }
}
