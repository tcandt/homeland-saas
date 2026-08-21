const http = require("http");
const { getDatabase } = require("../src/banking/mongodb");

const GATEWAY_URL = process.env.BIDV_GATEWAY_URL || "http://localhost:8787/bank-events";

async function seedInvoices() {
  const db = await getDatabase();
  const invoices = db.collection("invoices");

  const sampleInvoices = [
    {
      invoiceCode: "INV-2608-000125",
      paymentReference: "HL000125",
      tenantName: "Nguyễn Văn A",
      roomCode: "PN 31-02",
      total: 5500000,
      paidAmount: 0,
      remainingAmount: 5500000,
      status: "UNPAID",
      createdAt: new Date(),
    },
    {
      invoiceCode: "INV-2608-000126",
      paymentReference: "HL000126",
      tenantName: "Trần Thị B",
      roomCode: "PN 12-05",
      total: 1200000,
      paidAmount: 0,
      remainingAmount: 1200000,
      status: "UNPAID",
      createdAt: new Date(),
    },
  ];

  for (const inv of sampleInvoices) {
    await invoices.updateOne(
      { paymentReference: inv.paymentReference },
      { $setOnInsert: inv },
      { upsert: true }
    );
  }
  console.log("✓ Seeded sample invoices for reconciliation matching.");
}

const MOCK_TRANSACTIONS = [
  {
    transactionId: "BIDV_MOCK_MATCH_001",
    amount: 5500000,
    direction: "CREDIT",
    transactionTime: new Date().toISOString(),
    description: "NGUYEN VAN A CK HL000125",
    balanceAfter: 35000000,
  },
  {
    transactionId: "BIDV_MOCK_MATCH_002",
    amount: 1200000,
    direction: "CREDIT",
    transactionTime: new Date().toISOString(),
    description: "TRAN THI B THANH TOAN HL000126",
    balanceAfter: 36200000,
  },
  {
    transactionId: "BIDV_MOCK_MATCH_003",
    amount: 500000,
    direction: "DEBIT",
    transactionTime: new Date().toISOString(),
    description: "RUT TIEN ATM BIDV",
    balanceAfter: 35700000,
  },
];

function sendTransaction(data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request(
      GATEWAY_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve(JSON.parse(body)));
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  await seedInvoices();
  console.log(`📡 Sending ${MOCK_TRANSACTIONS.length} mock transactions to ${GATEWAY_URL}...\n`);
  for (const tx of MOCK_TRANSACTIONS) {
    const res = await sendTransaction(tx);
    console.log(
      `[${res.success ? "SUCCESS" : "FAILED"}] ID: ${tx.transactionId} -> Ref: ${res.reference || "None"} -> Reconcile: ${res.reconciliation?.status || "DUPLICATE"}`
    );
  }
}

main().catch(console.error);
