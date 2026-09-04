import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

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

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const templatePath = resolveTaiLieuPath('CT01.docx');

    // Check if the file exists
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: 'Không tìm thấy file mẫu CT01 tại ' + templatePath }, { status: 404 });
    }

    const content = fs.readFileSync(templatePath);

    // Create a pizzip instance
    const zip = new PizZip(content);

    // Create docxtemplater instance
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    const cleanCccd = (cccdStr: string): string => {
      if (!cccdStr) return '';
      const match = cccdStr.match(/\d{12}/);
      if (match) return match[0];
      const digits = cccdStr.replace(/\D/g, '');
      return digits.substring(0, 12);
    };

    const tenantCccd = cleanCccd(data.tenantDraft?.cccd || '');
    const isThe = data.ct01Draft?.hoTenChuHo?.toUpperCase().includes('THỂ') || data.ct01Draft?.chuNha === 'THE';
    const landlordCccdStr = isThe ? "066094006596" : "054097010677";
    const landlordCccd = cleanCccd(data.ct01Draft?.cccdChuHo || landlordCccdStr);

    // Map data
    const templateData = {
      ho_ten_chu_ho: data.ct01Draft?.hoTenChuHo || '',
      quan_he_voi_chu_ho: data.ct01Draft?.quanHeVoiChuHo || '',
      ho_ten: data.tenantDraft?.name || '',
      sdt: data.tenantDraft?.phone || '',
      cccd: data.tenantDraft?.cccd || '',
      gioi_tinh: data.tenantDraft?.gender || '',
      ngay_sinh: data.tenantDraft?.birthDate || '',
      quoc_tich: data.tenantDraft?.nationality || '',
      thuong_tru: data.tenantDraft?.address || '',
      ds_thanh_vien: data.ct01Draft?.thanhVien?.map((member: any, index: number) => ({
        stt: index + 1,
        ho_ten: member.name || '',
        ngay_sinh: member.birthDate || '',
        gioi_tinh: member.gender || '',
        cccd: member.cccd || '',
        quan_he: member.relationship || '',
      })) || [],
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

    doc.render(templateData);

    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    return new NextResponse(buf as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="CT01_KhachThue.docx"`,
      },
    });

  } catch (error: any) {
    console.error('Error exporting CT01:', error);
    
    let errorMessage = error?.message || 'Có lỗi khi xuất file CT01. Hãy chắc chắn file là định dạng .docx hợp lệ';
    
    // Check if it's the specific docxtemplater filetype error
    if (errorMessage.includes('The filetype for this file could not be identified')) {
      errorMessage = 'File CT01.doc hiện tại không phải là file Word (.docx) hợp lệ (có thể là file Theme hoặc file rỗng không có nội dung văn bản). Vui lòng mở bằng Microsoft Word, điền nội dung mẫu CT01 và "Save As" thành định dạng ".docx" chuẩn.';
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
