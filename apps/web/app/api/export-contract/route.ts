import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { execSync } from 'child_process';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    console.log('--- EXPORT CONTRACT PAYLOAD ---', data);
    
    const candidates = [
      path.join(process.cwd(), 'tai-lieu', 'HOP_DONG_1PN.docx'),
      path.join(process.cwd(), '..', '..', 'tai-lieu', 'HOP_DONG_1PN.docx'),
      path.join('/app', 'tai-lieu', 'HOP_DONG_1PN.docx'),
      'd:\\homeland-new\\homeland-saas\\tai-lieu\\HOP_DONG_1PN.docx',
    ];
    let templatePath = candidates.find(p => fs.existsSync(p)) || candidates[0];

    // Check if the file exists
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: 'Không tìm thấy file mẫu hợp đồng tại ' + templatePath }, { status: 404 });
    }

    const content = fs.readFileSync(templatePath);

    // Create a pizzip instance
    const zip = new PizZip(content);

    // Create docxtemplater instance
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

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
        hoTenChuNha: "PHAN VĂN THẾ",
        ngaySinhChuNha: "24/11/1994",
        cccdChuNha: "066094006596 , Cấp ngày: 15/10/2025 tại Cục cảnh sát",
        diaChiChuNha: "LK01.31 Khu đô thị Ân Phú , phường Tân An , tỉnh Đắk Lắk",
        dienThoaiChuNha: "0373129295 - 0567.79.2222 ( Thế )",
        chuTaiKhoan: "HKD PHAN VAN THE",
        soTaiKhoan: "8827905414",
        nganHang: "BIDV",
      },
    };

    const defaultLandlord = LANDLORDS[data.chuNha || "TINH"] || LANDLORDS["TINH"];
    const today = new Date();
    const defaultDay = String(today.getDate()).padStart(2, '0');
    const defaultMonth = String(today.getMonth() + 1).padStart(2, '0');
    const defaultYear = String(today.getFullYear());

    // Map data
    const templateData = {
      hoTen: data.hoTen || '',
      ngaySinh: data.ngaySinh || '',
      cccd: data.cccd || '',
      diaChi: data.diaChi || '',
      dienThoai: data.dienThoai || '',
      dienThoaiNguoithan: data.dienThoaiNguoithan || '-',
      mucDichThue: data.mucDichThue || 'Để ở',
      tienThue: data.tienThue ? data.tienThue.toLocaleString('vi-VN') : '',
      tienThueChu: data.tienThueChu || '',
      tienCoc: data.tienCoc ? data.tienCoc.toLocaleString('vi-VN') : '',
      tienCocChu: data.tienCocChu || '',
      ngayBatDau: data.ngayBatDau || '',
      ngayKetThuc: data.ngayKetThuc || '',
      ngayKetthuc: data.ngayKetThuc || '',
      Hanthue: data.thoiHanThue || data.Hanthue || '1 năm',
      maPhong: data.maPhong || '',
      soPhongNgu: data.soPhongNgu || '1 phòng ngủ',
      thoiHanThue: data.thoiHanThue || '1 năm',
      hoTenChuNha: data.hoTenChuNha || defaultLandlord.hoTenChuNha,
      ngaySinhChuNha: data.ngaySinhChuNha || defaultLandlord.ngaySinhChuNha,
      cccdChuNha: data.cccdChuNha || defaultLandlord.cccdChuNha,
      diaChiChuNha: data.diaChiChuNha || defaultLandlord.diaChiChuNha,
      dienThoaiChuNha: data.dienThoaiChuNha || defaultLandlord.dienThoaiChuNha,
      chuTaiKhoan: data.chuTaiKhoan || defaultLandlord.chuTaiKhoan,
      soTaiKhoan: data.soTaiKhoan || defaultLandlord.soTaiKhoan,
      nganHang: data.nganHang || defaultLandlord.nganHang,
      toaNha: data.toaNha || 'Tòa nhà Homeland',
      diachiToanha: data.diachiToanha || 'Khu đô thị Ân Phú , phường Tân An , tỉnh Đắk Lắk',
      ngayKyHD: data.ngayKyHD || defaultDay,
      thangKyHD: data.thangKyHD || defaultMonth,
      namKyHD: data.namKyHD || defaultYear,
      ngayKyhopdong: data.ngayKyhopdong || `${defaultDay}/${defaultMonth}/${defaultYear}`,
      ngayThanhToanDauTien: data.ngayThanhToanDauTien || `${defaultDay}/${defaultMonth}/${defaultYear}`,
    };

    doc.render(templateData);

    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    const url = new URL(request.url);
    const wantPdf = url.searchParams.get('format') === 'pdf' || data.format === 'pdf';

    if (wantPdf) {
      const tempDir = path.join(process.cwd(), 'scratch');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const tempId = `contract_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const tempDocx = path.join(tempDir, `${tempId}.docx`);
      const tempPdf = path.join(tempDir, `${tempId}.pdf`);

      fs.writeFileSync(tempDocx, buf);

      try {
        const psScript = `
$word = New-Object -ComObject Word.Application;
$word.Visible = $false;
try {
  $doc = $word.Documents.Open('${tempDocx.replace(/\\/g, '\\\\')}');
  $doc.SaveAs('${tempPdf.replace(/\\/g, '\\\\')}', 17);
  $doc.Close();
} finally {
  $word.Quit();
}
`;
        execSync(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`, { stdio: 'pipe' });

        if (fs.existsSync(tempPdf)) {
          const pdfBuf = fs.readFileSync(tempPdf);
          try { fs.unlinkSync(tempDocx); } catch {}
          try { fs.unlinkSync(tempPdf); } catch {}

          const safeCustomer = (data.hoTen || 'KhachHang').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_');
          const safeRoom = (data.maPhong || '').replace(/[^a-zA-Z0-9]/g, '');
          const filename = `HopDong_${safeCustomer}${safeRoom ? `_${safeRoom}` : ''}.pdf`;

          return new NextResponse(pdfBuf as any, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `inline; filename="${filename}"`,
            },
          });
        }
      } catch (comErr) {
        console.warn('Word COM conversion failed, falling back to docx:', comErr);
        try { if (fs.existsSync(tempDocx)) fs.unlinkSync(tempDocx); } catch {}
        try { if (fs.existsSync(tempPdf)) fs.unlinkSync(tempPdf); } catch {}
      }
    }

    const safeCustomer = (data.hoTen || 'KhachHang').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_');
    const safeRoom = (data.maPhong || '').replace(/[^a-zA-Z0-9]/g, '');
    const filename = `HopDong_${safeCustomer}${safeRoom ? `_${safeRoom}` : ''}.docx`;

    return new NextResponse(buf as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error: any) {
    console.error('================ EXPORT ERROR ================');
    console.error('Error exporting Contract:', error);
    console.error('Error stack:', error?.stack);
    
    let errorMessage = error?.message || 'Có lỗi khi xuất file Hợp đồng. Hãy chắc chắn file là định dạng .docx hợp lệ';
    
    // Check if it's the specific docxtemplater filetype error
    if (errorMessage.includes('The filetype for this file could not be identified')) {
      errorMessage = 'File HOP_DONG_1PN.docx hiện tại không phải là file Word (.docx) hợp lệ hoặc bị lỗi. Vui lòng kiểm tra lại file mẫu.';
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
