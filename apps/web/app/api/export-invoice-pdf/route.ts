import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function findBrowserPath(): string | null {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function formatVnd(val: number | string) {
  return `${Number(val || 0).toLocaleString('vi-VN')} đ`;
}

export async function POST(request: Request) {
  let tempHtml = '';
  let tempPdf = '';

  try {
    const data = await request.json();

    const invoiceCode = data.invoiceCode || 'HD-P24-05-4467';
    const periodLabel = data.periodLabel || 'Tháng 10/2026';
    const creationDateStr = data.creationDateStr || new Date().toLocaleString('vi-VN');
    const dueDateStr = data.dueDateStr || new Date().toLocaleDateString('vi-VN');
    const isPaid = data.isPaid ?? true;
    const customerName = data.customerName || 'Khách hàng';
    const customerPhone = data.customerPhone || '---';
    const roomName = data.roomName || '---';
    const buildingName = data.buildingName || 'Tòa nhà';
    const contractCode = data.contractCode || '---';
    const paymentMethod = data.paymentMethod || 'Chuyển khoản / Tiền mặt';
    const totalAmount = Number(data.totalAmount || 0);
    const title = data.title || 'HÓA ĐƠN THANH TOÁN';
    const subtitle = data.subtitle || 'Dịch vụ quản lý và vận hành tòa nhà';
    const codeLabel = data.codeLabel || 'MÃ HÓA ĐƠN';
    const infoTitle = data.infoTitle || 'THÔNG TIN KHÁCH THUÊ';
    const customerLabel = data.customerLabel || 'Khách thuê';
    const statusLabel = data.statusLabel || 'Đã thanh toán';

    const items = Array.isArray(data.items) && data.items.length > 0
      ? data.items
      : [
          {
            stt: 1,
            name: `Tiền thuê phòng ${roomName} - Kỳ ${periodLabel} (Thu trước)`,
            amount: totalAmount > 100000 ? totalAmount - 100000 : totalAmount,
          },
          {
            stt: 2,
            name: 'Tiền nước sinh hoạt (1 người) - Sử dụng kỳ trước (Thu sau)',
            amount: totalAmount > 100000 ? 100000 : 0,
          },
        ];

    // Read brand logo if available and convert to Base64
    let logoBase64 = '';
    try {
      const logoPath = path.join(process.cwd(), 'apps', 'web', 'public', 'logo-homeland.png');
      const altLogoPath = path.join(process.cwd(), 'public', 'logo-homeland.png');
      const targetPath = fs.existsSync(logoPath) ? logoPath : fs.existsSync(altLogoPath) ? altLogoPath : '';
      if (targetPath) {
        logoBase64 = `data:image/png;base64,${fs.readFileSync(targetPath).toString('base64')}`;
      }
    } catch {}

    const tableRowsHtml = items
      .map(
        (it: any, idx: number) => `
        <tr style="border-top: 1px solid #f1f5f9;">
          <td style="padding: 6px 12px; text-align: center; color: #94a3b8; font-family: monospace; font-size: 13px;">${it.stt || idx + 1}</td>
          <td style="padding: 6px 12px; font-weight: 600; color: #1e293b; font-size: 13px;">${it.name || ''}</td>
          <td style="padding: 6px 12px; text-align: right; font-family: monospace; font-weight: bold; color: #0f172a; font-size: 13px; white-space: nowrap;">${formatVnd(it.amount)}</td>
        </tr>
      `
      )
      .join('');

    const sigHeight = items.length > 2 ? 38 : 56;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * {
      box-sizing: border-box !important;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @page {
      size: A4 portrait;
      margin: 5mm 10mm;
    }
    #homeland-printable-invoice {
      width: 100% !important;
      height: 100% !important;
      max-height: 100% !important;
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      background: #ffffff;
      padding: 0;
      margin: 0;
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  </style>
</head>
<body>
  <div id="homeland-printable-invoice" class="w-full h-full flex flex-col justify-between">
    <!-- UPPER SECTION: BRAND, META, CUSTOMER INFO, CELEBRATION, ITEMS TABLE -->
    <div class="space-y-2.5 shrink-0">
      <!-- 1. BRAND HEADER -->
      <div class="flex items-center justify-between pb-0.5">
        <div class="flex items-center gap-2.5">
          ${
            logoBase64
              ? `<img src="${logoBase64}" alt="Homeland Logo" style="height: 40px; width: 40px; object-fit: contain; flex-shrink: 0;" />`
              : `<div style="height: 38px; width: 38px; background: #059669; border-radius: 8px;"></div>`
          }
          <div class="flex flex-col leading-none">
            <div class="font-black tracking-tight text-2xl text-slate-900 flex items-baseline">
              <span>HOME</span>
              <span class="text-emerald-600 ml-1">LAND</span>
            </div>
            <div class="text-[10.5px] font-black uppercase tracking-[0.24em] text-emerald-600 mt-0.5">
              PREMIUM CRM
            </div>
          </div>
        </div>
        <div class="text-right space-y-0.5">
          <div class="text-[13px] font-medium text-slate-500">Quản lý tòa nhà thông minh</div>
          <div class="text-[13px] font-medium text-slate-500">Nâng tầm trải nghiệm sống</div>
        </div>
      </div>

      <div class="w-full h-[1px] bg-slate-200"></div>

      <!-- 2. TITLE & CODE ROW -->
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-3xl font-black uppercase tracking-tight text-slate-900">${title}</h1>
          <p class="text-sm font-medium text-slate-500 mt-0.5">${subtitle}</p>
        </div>
        <div class="rounded-xl border border-indigo-100 bg-[#f5f3ff] px-4 py-2 text-center shrink-0">
          <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">${codeLabel}</div>
          <div class="text-lg font-black font-mono text-[#4338ca] tracking-tight">${invoiceCode}</div>
        </div>
      </div>

      <!-- 3. 4-ITEM META PILL ROW -->
      <div class="rounded-xl border border-slate-200 bg-white p-3 grid grid-cols-4 gap-3 items-center">
        <div>
          <div class="text-[11px] text-slate-400 font-medium">Kỳ hóa đơn</div>
          <div class="text-sm font-bold text-slate-900 mt-1">${periodLabel}</div>
        </div>
        <div>
          <div class="text-[11px] text-slate-400 font-medium">Ngày lập</div>
          <div class="text-sm font-bold text-slate-900 mt-1">${creationDateStr}</div>
        </div>
        <div>
          <div class="text-[11px] text-slate-400 font-medium">Hạn thanh toán</div>
          <div class="text-sm font-bold text-slate-900 mt-1">${dueDateStr}</div>
        </div>
        <div class="flex justify-end">
          <div class="rounded-xl border border-emerald-200 bg-[#ecfdf5] px-3 py-1.5 text-center">
            <div class="text-[10px] font-semibold text-emerald-700 leading-none">Trạng thái</div>
            <div class="text-[13px] font-black text-emerald-800 leading-tight mt-0.5">${isPaid ? statusLabel : 'Chờ thanh toán'}</div>
          </div>
        </div>
      </div>

      <!-- 4. INFORMATION CARD -->
      <div class="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5">
        <div class="text-xs font-black uppercase tracking-wider text-[#4338ca]">${infoTitle}</div>
        <div class="grid grid-cols-3 gap-y-2.5 gap-x-4 text-xs">
          <div>
            <div class="text-[11px] text-slate-400">${customerLabel}</div>
            <div class="font-bold text-slate-900 text-sm mt-1">${customerName}</div>
            <div class="text-[11px] text-slate-400 mt-2">SĐT</div>
            <div class="font-bold font-mono text-slate-900 text-sm mt-1">${customerPhone}</div>
          </div>
          <div>
            <div class="text-[11px] text-slate-400">Phòng</div>
            <div class="font-bold text-slate-900 text-sm mt-1">${roomName}</div>
            <div class="text-[11px] text-slate-400 mt-2">Tòa nhà</div>
            <div class="font-bold text-slate-900 text-sm mt-1">${buildingName}</div>
          </div>
          <div>
            <div class="text-[11px] text-slate-400">Hợp đồng</div>
            <div class="font-bold font-mono text-slate-900 text-sm mt-1 truncate">${contractCode}</div>
            <div class="text-[11px] text-slate-400 mt-2">Hình thức thanh toán</div>
            <div class="font-bold text-slate-900 text-sm mt-1">${paymentMethod}</div>
          </div>
        </div>
      </div>

      <!-- 5. CELEBRATION BANNER (ENLARGED & MOVED HIGH UP) -->
      <div class="rounded-2xl border border-emerald-200 bg-gradient-to-b from-[#f0fdf4] to-[#ecfdf5]/60 py-6 px-6 text-center shadow-xs">
        <div class="inline-flex items-center justify-center mb-1.5">
          <div style="height: 68px; width: 68px; border-radius: 9999px; background: #10b981; color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25); border: 4px solid #d1fae5;">
            <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
        </div>
        <div class="text-base font-black uppercase tracking-wider text-emerald-800 mt-1 mb-0.5">ĐÃ THANH TOÁN THÀNH CÔNG</div>
        <div class="text-5xl font-black font-mono text-emerald-600 tracking-tight my-2">${formatVnd(totalAmount)}</div>
        <div class="text-[13.5px] text-slate-600 font-medium mt-1">Hóa đơn đã được đối soát và ghi nhận vào sổ cái thu tiền.</div>
      </div>

      <!-- 6. ITEMS TABLE -->
      <div class="overflow-hidden rounded-xl border border-slate-200">
        <table class="w-full text-left" style="border-collapse: collapse;">
          <thead class="bg-slate-50 border-b border-slate-200 text-slate-700 font-black">
            <tr>
              <th style="padding: 6px 12px; width: 48px; text-align: center; font-size: 13px;">STT</th>
              <th style="padding: 6px 12px; font-size: 13px;">Nội dung khoản thu</th>
              <th style="padding: 6px 12px; width: 170px; text-align: right; font-size: 13px;">Số tiền</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 font-medium text-slate-800">
            ${tableRowsHtml}
            <tr style="background: rgba(245, 243, 255, 0.6); font-weight: 900; border-top: 1px solid #cbd5e1;">
              <td colspan="2" style="padding: 8px 12px; font-size: 15px; color: #4338ca;">Tổng cộng</td>
              <td style="padding: 8px 12px; text-align: right; font-family: monospace; font-size: 16px; font-weight: 900; color: #4338ca; white-space: nowrap;">${formatVnd(totalAmount)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 7. CONFIRMATION STRIP -->
      <div class="rounded-xl border border-emerald-200 bg-[#f0fdf4] px-4 py-2 flex items-center gap-2.5 text-xs text-emerald-800 font-medium">
        <div style="height: 20px; width: 20px; border-radius: 9999px; background: #10b981; color: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <div>
          <b>Đã thu đủ ${formatVnd(totalAmount)}.</b> Hóa đơn đã được đối soát và ghi nhận thành công vào sổ cái thu tiền.
        </div>
      </div>
    </div>

    <!-- ZONE 3: BOTTOM -->
    <div class="space-y-2 shrink-0">
      <!-- 8. 2 BOTTOM CARDS -->
      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-xl border border-slate-200 p-3 bg-white space-y-1.5">
          <div class="text-xs font-black uppercase tracking-wider text-[#4338ca]">GHI CHÚ</div>
          <ul class="text-[11px] text-slate-600 space-y-1 list-disc list-inside leading-relaxed">
            <li>Hóa đơn này được lập tự động từ hệ thống Homeland Premium CRM.</li>
            <li>Vui lòng liên hệ Ban quản lý nếu có thắc mắc về nội dung hóa đơn.</li>
          </ul>
        </div>
        <div class="rounded-xl border border-slate-200 p-3 bg-white flex items-center justify-between gap-3">
          <div class="space-y-1 min-w-0">
            <div class="text-xs font-black uppercase tracking-wider text-[#4338ca]">THÔNG TIN THANH TOÁN</div>
            <p class="text-[11px] text-slate-600 leading-relaxed">Quét mã QR để xem chi tiết giao dịch và đối soát thanh toán.</p>
          </div>
          <div style="height: 60px; width: 60px; flex-shrink: 0; border-radius: 8px; border: 1px solid #e2e8f0; background: white; padding: 3px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            <svg viewBox="0 0 100 100" style="width: 100%; height: 100%;">
              <rect width="100" height="100" fill="#ffffff" />
              <rect x="5" y="5" width="28" height="28" fill="#1e1b4b" rx="2" />
              <rect x="9" y="9" width="20" height="20" fill="#ffffff" rx="1.5" />
              <rect x="13" y="13" width="12" height="12" fill="#1e1b4b" rx="1" />
              <rect x="67" y="5" width="28" height="28" fill="#1e1b4b" rx="2" />
              <rect x="71" y="9" width="20" height="20" fill="#ffffff" rx="1.5" />
              <rect x="75" y="13" width="12" height="12" fill="#1e1b4b" rx="1" />
              <rect x="5" y="67" width="28" height="28" fill="#1e1b4b" rx="2" />
              <rect x="9" y="71" width="20" height="20" fill="#ffffff" rx="1.5" />
              <rect x="13" y="75" width="12" height="12" fill="#1e1b4b" rx="1" />
              <rect x="38" y="10" width="6" height="6" fill="#1e1b4b" />
              <rect x="48" y="10" width="6" height="6" fill="#1e1b4b" />
              <rect x="56" y="16" width="6" height="6" fill="#1e1b4b" />
              <rect x="38" y="24" width="6" height="6" fill="#1e1b4b" />
              <rect x="48" y="24" width="6" height="6" fill="#1e1b4b" />
              <rect x="10" y="38" width="6" height="6" fill="#1e1b4b" />
              <rect x="18" y="46" width="6" height="6" fill="#1e1b4b" />
              <rect x="26" y="38" width="6" height="6" fill="#1e1b4b" />
              <rect x="38" y="38" width="8" height="8" fill="#4338ca" rx="1" />
              <rect x="52" y="38" width="8" height="8" fill="#1e1b4b" />
              <rect x="66" y="38" width="6" height="6" fill="#1e1b4b" />
              <rect x="78" y="46" width="6" height="6" fill="#1e1b4b" />
              <rect x="86" y="38" width="6" height="6" fill="#1e1b4b" />
              <rect x="38" y="52" width="6" height="6" fill="#1e1b4b" />
              <rect x="48" y="52" width="8" height="8" fill="#4338ca" rx="1" />
              <rect x="62" y="52" width="6" height="6" fill="#1e1b4b" />
              <rect x="76" y="58" width="6" height="6" fill="#1e1b4b" />
              <rect x="86" y="52" width="6" height="6" fill="#1e1b4b" />
              <rect x="38" y="66" width="6" height="6" fill="#1e1b4b" />
              <rect x="48" y="74" width="6" height="6" fill="#1e1b4b" />
              <rect x="58" y="66" width="6" height="6" fill="#1e1b4b" />
              <rect x="70" y="72" width="6" height="6" fill="#1e1b4b" />
              <rect x="82" y="68" width="6" height="6" fill="#1e1b4b" />
              <rect x="42" y="86" width="6" height="6" fill="#1e1b4b" />
              <rect x="54" y="84" width="8" height="8" fill="#1e1b4b" />
              <rect x="68" y="86" width="6" height="6" fill="#1e1b4b" />
              <rect x="82" y="84" width="6" height="6" fill="#1e1b4b" />
            </svg>
          </div>
        </div>
      </div>

      <!-- 9. SIGNATURES (3 PARTIES) -->
      <div class="pt-2 pb-0.5">
        <div class="grid grid-cols-3 gap-3 text-center">
          <div>
            <div class="text-sm font-bold text-slate-800">Người lập phiếu</div>
            <div class="text-[11px] italic text-slate-400 mt-0.5">(Ký, ghi rõ họ tên)</div>
            <div style="height: ${sigHeight}px;"></div>
            <div class="border-b border-slate-300 w-3/4 mx-auto"></div>
            <div style="font-size: 12px; font-weight: 600; color: #334155; margin-top: 4px; min-height: 16px;"></div>
          </div>
          <div>
            <div class="text-sm font-bold text-slate-800">Khách hàng</div>
            <div class="text-[11px] italic text-slate-400 mt-0.5">(Ký, ghi rõ họ tên)</div>
            <div style="height: ${sigHeight}px;"></div>
            <div class="border-b border-slate-300 w-3/4 mx-auto"></div>
            <div style="font-size: 12px; font-weight: 700; color: #1e293b; margin-top: 4px; min-height: 16px;">${customerName}</div>
          </div>
          <div>
            <div class="text-sm font-bold text-slate-800">Kế toán / Xác nhận</div>
            <div class="text-[11px] italic text-slate-400 mt-0.5">(Ký, ghi rõ họ tên)</div>
            <div style="height: ${sigHeight}px;"></div>
            <div class="border-b border-slate-300 w-3/4 mx-auto"></div>
            <div style="font-size: 12px; font-weight: 600; color: #334155; margin-top: 4px; min-height: 16px;"></div>
          </div>
        </div>
      </div>

      <!-- 10. DOCUMENT FOOTER -->
      <div class="pt-1.5 border-t border-slate-200 flex items-center justify-between text-[10.5px] text-slate-400">
        <div>In từ Homeland Premium CRM • Ngày in: ${creationDateStr}</div>
        <div class="font-mono font-semibold">1 / 1</div>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const browserPath = findBrowserPath();
    if (!browserPath) {
      return NextResponse.json(
        { error: 'Không tìm thấy trình duyệt headless (Chrome/Chromium/Edge) trên hệ thống.' },
        { status: 500 }
      );
    }

    const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    tempHtml = path.join(os.tmpdir(), `invoice_${uniqueId}.html`);
    tempPdf = path.join(os.tmpdir(), `invoice_${uniqueId}.pdf`);

    fs.writeFileSync(tempHtml, htmlContent, 'utf-8');

    await execFileAsync(
      browserPath,
      [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        `--print-to-pdf=${tempPdf}`,
        tempHtml,
      ],
      { timeout: 20000 }
    );

    if (!fs.existsSync(tempPdf)) {
      throw new Error('Chrome did not generate PDF file');
    }

    const pdfBuffer = fs.readFileSync(tempPdf);

    const safeCode = invoiceCode.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `HoaDon_${safeCode}.pdf`;
    const encodedFilename = encodeURIComponent(filename);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
        'Cache-Control': 'no-store, no-cache',
      },
    });
  } catch (err: any) {
    console.error('Error generating invoice PDF:', err);
    return NextResponse.json(
      { error: err?.message || 'Có lỗi khi xuất file PDF hóa đơn' },
      { status: 500 }
    );
  } finally {
    if (tempHtml && fs.existsSync(tempHtml)) {
      try {
        fs.unlinkSync(tempHtml);
      } catch {}
    }
    if (tempPdf && fs.existsSync(tempPdf)) {
      try {
        fs.unlinkSync(tempPdf);
      } catch {}
    }
  }
}
