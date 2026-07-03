import { APIRequestContext } from '@playwright/test';

export class DataFactory {
  constructor(private request: APIRequestContext, private token?: string) {}

  private async post(endpoint: string, data: any) {
    const url = endpoint.startsWith('http') ? endpoint : `http://127.0.0.1:3000${endpoint}`;
    const headers: any = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    
    const res = await this.request.post(url, {
      data,
      headers
    });
    const body = await res.json();
    if (!res.ok() || !body.success) {
      throw new Error(`DataFactory Error on POST ${url}: ${JSON.stringify(body)}`);
    }
    return body.data;
  }

  private async delete(endpoint: string) {
    const url = endpoint.startsWith('http') ? endpoint : `http://127.0.0.1:3000${endpoint}`;
    const headers: any = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    
    const res = await this.request.delete(url, { headers });
    if (!res.ok()) {
      console.warn(`DataFactory Warn on DELETE ${url}: ${res.statusText()}`);
    }
  }

  async createBuilding(prefix: string) {
    return this.post('/api/v1/buildings', {
      name: `${prefix}-Building`,
      code: prefix,
      address: '123 E2E Street'
    });
  }

  async createFloor(prefix: string, buildingId: string) {
    return this.post('/api/v1/floors', {
      buildingId,
      name: `${prefix}-Floor`,
      level: 1
    });
  }

  async createRoom(prefix: string, buildingId: string, floorId: string) {
    return this.post('/api/v1/rooms', {
      buildingId,
      floorId,
      name: `${prefix}-Room 101`,
      code: `${prefix}-R101`,
      monthlyPrice: 5000000
    });
  }

  async createCustomer(prefix: string) {
    return this.post('/api/v1/customers', {
      fullName: `${prefix}-Customer`,
      phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `${prefix.toLowerCase()}@test.local`,
      type: 'INDIVIDUAL'
    });
  }

  async createContract(prefix: string, roomId: string, customerId: string) {
    return this.post('/api/v1/contracts', {
      roomId,
      customerId,
      contractCode: `${prefix}-Contract`,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 31536000000).toISOString(), // +1 year
      rentAmount: 5000000,
      depositAmount: 5000000,
      status: 'ACTIVE'
    });
  }

  async createDeposit(prefix: string, roomId: string, customerId: string) {
    return this.post('/api/v1/deposits', {
      code: `${prefix}-Deposit`,
      roomId,
      customerId,
      amount: 5000000,
      type: 'BOOKING'
    });
  }

  async collectDeposit(prefix: string, depositId: string) {
    return this.post(`/api/v1/deposits/${depositId}/collect`, {
      note: `Thu tien coc test ${prefix}`
    });
  }

  async createInvoice(prefix: string, contractId: string, customerId: string, roomId: string) {
    return this.post('/api/v1/invoices', {
      contractId,
      customerId,
      roomId,
      period: '2026-06',
      totalAmount: 5000000,
      dueDate: new Date().toISOString(),
      status: 'UNPAID'
    });
  }

  async createPayment(prefix: string, invoiceId: string, amount: number) {
    const headers: any = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    
    return this.request.patch(`http://127.0.0.1:3000/api/v1/invoices/${invoiceId}`, {
      data: {
        status: 'PAID',
        paidAmount: amount
      },
      headers
    }).then(r => r.json());
  }

  async generateDocument(prefix: string, templateCode: string) {
    return this.post('/api/v1/documents/new/generate', {
      templateCode,
      title: `${prefix}-Document`,
      payload: {
        contractNumber: `${prefix}-123`,
        partyA_Name: 'Homeland',
        partyB_Name: `${prefix}-Customer`,
        depositAmount: 5000000,
        rentAmount: 10000000
      }
    });
  }

  async requestSignature(prefix: string, documentId: string) {
    return this.post('/api/v1/signature-requests', {
      documentId,
      parties: [
        { name: `${prefix}-Signer`, role: 'CLIENT', email: `${prefix}@test.local` }
      ]
    });
  }

  async applySignature(prefix: string, signatureRequestId: string, partyId: string) {
    return this.post(`/api/v1/signature-requests/${signatureRequestId}/sign`, {
      partyId,
      signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    });
  }

  async downloadDocument(documentId: string, token: string) {
    const url = `http://127.0.0.1:3000/api/v1/documents/${documentId}/download`;
    const res = await this.request.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return res;
  }

  // Cleanup should be called in reverse dependency order
  async cleanup(ids: {
    paymentId?: string,
    invoiceId?: string,
    depositId?: string,
    contractId?: string,
    customerId?: string,
    roomId?: string,
    buildingId?: string,
    documentId?: string,
    notificationId?: string
  }) {
    if (ids.paymentId) await this.delete(`/api/v1/payments/${ids.paymentId}`);
    if (ids.invoiceId) await this.delete(`/api/v1/invoices/${ids.invoiceId}`);
    if (ids.depositId) await this.delete(`/api/v1/deposits/${ids.depositId}`);
    if (ids.contractId) await this.delete(`/api/v1/contracts/${ids.contractId}`);
    if (ids.customerId) await this.delete(`/api/v1/customers/${ids.customerId}`);
    if (ids.roomId) await this.delete(`/api/v1/rooms/${ids.roomId}`);
    if (ids.buildingId) await this.delete(`/api/v1/buildings/${ids.buildingId}`);
    if (ids.documentId) await this.delete(`/api/v1/documents/${ids.documentId}`);
    if (ids.notificationId) await this.delete(`/api/v1/notifications/${ids.notificationId}`);
  }

  async triggerWorkflowNotification(customerId: string, tenantId: string = 'system') {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 15);
    return this.post('/api/v1/automation/rules/contract.expiring.30_days/run', {
      customerId,
      tenantId,
      endDate: endDate.toISOString(),
      title: 'E2E Test Contract Expiring',
      message: 'Your test contract will expire in 15 days.'
    });
  }

  async triggerTestFailedQueueItem() {
    return this.post('/api/v1/notifications/test-utils/queue/failed', {});
  }
}
