import type { PrismaClient } from '@prisma/client';

export async function seedDocumentTemplates(prisma: PrismaClient, tenantId: string) {
  const docTemplates = [
    {
      code: 'CONTRACT_TEMPLATE',
      name: 'Mẫu Hợp Đồng Thuê Phòng',
      type: 'CONTRACT' as any,
      content: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1 style="text-align: center;">HỢP ĐỒNG THUÊ PHÒNG</h1>
          <p><strong>Bên A (Bên cho thuê):</strong> HomeLand Premium</p>
          <p><strong>Bên B (Bên thuê):</strong> {{customerName}}</p>
          <p><strong>Phòng:</strong> {{roomCode}}</p>
          <p><strong>Giá thuê:</strong> {{formatCurrency monthlyRent "VND"}}/tháng</p>
          <p><strong>Tiền cọc:</strong> {{formatCurrency depositMoney "VND"}}</p>
          <p>Hợp đồng có giá trị từ ngày {{formatDate startDate}} đến ngày {{formatDate endDate}}.</p>
          <br/><br/>
          <table style="width: 100%;">
            <tr>
              <td style="text-align: center; width: 50%;"><strong>BÊN A</strong><br/>(Ký và ghi rõ họ tên)</td>
              <td style="text-align: center; width: 50%;"><strong>BÊN B</strong><br/>(Ký và ghi rõ họ tên)</td>
            </tr>
          </table>
        </div>
      `
    },
    {
      code: 'INVOICE_TEMPLATE',
      name: 'Mẫu Hóa Đơn',
      type: 'INVOICE' as any,
      content: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1 style="text-align: center;">HÓA ĐƠN THANH TOÁN</h1>
          <p><strong>Mã hóa đơn:</strong> {{code}}</p>
          <p><strong>Khách hàng:</strong> {{customerName}}</p>
          <p><strong>Hạn thanh toán:</strong> {{formatDate dueDate}}</p>
          <hr/>
          <p><strong>Tổng tiền:</strong> {{formatCurrency total "VND"}}</p>
        </div>
      `
    },
    {
      code: 'RECEIPT_TEMPLATE',
      name: 'Mẫu Phiếu Thu',
      type: 'RECEIPT' as any,
      content: `<div style="font-family: Arial, sans-serif; padding: 20px;"><h1 style="text-align: center;">PHIẾU THU</h1><p>Đã thu số tiền {{formatCurrency amount "VND"}} từ khách hàng {{customerName}}.</p></div>`
    },
    {
      code: 'DEPOSIT_AGREEMENT_TEMPLATE',
      name: 'Mẫu Thỏa Thuận Đặt Cọc',
      type: 'DEPOSIT' as any,
      content: `<div style="font-family: Arial, sans-serif; padding: 20px;"><h1 style="text-align: center;">THỎA THUẬN ĐẶT CỌC</h1><p>Khách hàng {{customerName}} đã đặt cọc số tiền {{formatCurrency amount "VND"}} cho phòng {{roomCode}}.</p></div>`
    },
    {
      code: 'HANDOVER_TEMPLATE',
      name: 'Biên Bản Bàn Giao',
      type: 'HANDOVER' as any,
      content: `<div style="font-family: Arial, sans-serif; padding: 20px;"><h1 style="text-align: center;">BIÊN BẢN BÀN GIAO</h1><p>Bàn giao phòng {{roomCode}} cho khách hàng {{customerName}}.</p></div>`
    }
  ];

  for (const dt of docTemplates) {
    await prisma.documentTemplate.upsert({
      where: { tenantId_code: { tenantId, code: dt.code } },
      update: {},
      create: { tenantId, ...dt }
    });
  }

  const rootFolders = ['Contracts', 'Invoices', 'Receipts', 'Signatures', 'Exports'];
  for (const name of rootFolders) {
    const exists = await prisma.documentFolder.findFirst({ where: { tenantId, name } });
    if (!exists) await prisma.documentFolder.create({ data: { tenantId, name } });
  }
}

