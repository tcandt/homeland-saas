import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

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

    // Map data
    const templateData = {
      hoTen: data.hoTen || '',
      ngaySinh: data.ngaySinh || '',
      cccd: data.cccd || '',
      diaChi: data.diaChi || '',
      dienThoai: data.dienThoai || '',
      dienThoaiNguoithan: data.dienThoaiNguoithan || '',
      mucDichThue: data.mucDichThue || '',
      tienThue: data.tienThue ? data.tienThue.toLocaleString('vi-VN') : '',
      tienThueChu: data.tienThueChu || '',
      tienCoc: data.tienCoc ? data.tienCoc.toLocaleString('vi-VN') : '',
      tienCocChu: data.tienCocChu || '',
      ngayBatDau: data.ngayBatDau || '',
      ngayKetThuc: data.ngayKetThuc || '',
      ngayKetthuc: data.ngayKetThuc || '',
      Hanthue: data.thoiHanThue || '',
      maPhong: data.maPhong || '',
      soPhongNgu: data.soPhongNgu || '',
      thoiHanThue: data.thoiHanThue || '',
      hoTenChuNha: data.hoTenChuNha || '',
      ngaySinhChuNha: data.ngaySinhChuNha || '',
      cccdChuNha: data.cccdChuNha || '',
      diaChiChuNha: data.diaChiChuNha || '',
      dienThoaiChuNha: data.dienThoaiChuNha || '',
      chuTaiKhoan: data.chuTaiKhoan || '',
      soTaiKhoan: data.soTaiKhoan || '',
      nganHang: data.nganHang || '',
      toaNha: data.toaNha || '',
      diachiToanha: data.diachiToanha || '',
      ngayKyHD: data.ngayKyHD || '',
      thangKyHD: data.thangKyHD || '',
      namKyHD: data.namKyHD || '',
      ngayKyhopdong: data.ngayKyhopdong || '',
      ngayThanhToanDauTien: data.ngayThanhToanDauTien || '',
    };

    doc.render(templateData);

    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    return new NextResponse(buf as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="HopDong_KhachHang.docx"`,
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
