require("dotenv").config();
const http = require("http");
const crypto = require("crypto");
const {
  getDatabase,
} = require("../src/banking/mongodb");
const {
  ensureIndexes,
  saveTransaction,
  updateReconciliationStatus,
} = require("../src/banking/bank-transactions.repository");
const {
  reconcileBankTransaction,
} = require("../src/reconciliation/reconcile-bank-transaction");

const PORT = Number(process.env.BIDV_GATEWAY_PORT || 8787);

function money(value) {
  return Number(value || 0).toLocaleString("vi-VN") + " ₫";
}

function extractHomelandReference(text) {
  const match = String(text)
    .toUpperCase()
    .match(/\bHL[A-Z0-9]{4,20}\b/);
  return match?.[0];
}

function normalize(input) {
  const amount = Math.abs(
    Number(
      input.amount ??
        input.transactionAmount ??
        input.transAmount ??
        0
    )
  );

  const type = String(
    input.direction ??
      input.type ??
      input.transactionType ??
      ""
  ).toUpperCase();

  let direction = "UNKNOWN";
  if (type === "IN" || type === "CREDIT" || type === "CR") {
    direction = "IN";
  }
  if (type === "OUT" || type === "DEBIT" || type === "DR") {
    direction = "OUT";
  }

  const description = String(
    input.description ??
      input.remark ??
      input.content ??
      input.memo ??
      ""
  );

  const externalId =
    String(
      input.transactionId ??
        input.transId ??
        input.externalId ??
        input.reference ??
        ""
    ) ||
    crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          amount,
          description,
          time:
            input.transactionTime ??
            input.transactionDate ??
            input.time,
        })
      )
      .digest("hex");

  return {
    bank: "BIDV",
    externalId,
    direction,
    amount,
    currency: input.currency || "VND",
    transactionTime:
      input.transactionTime ??
      input.transactionDate ??
      input.time ??
      new Date().toISOString(),
    description,
    reference:
      input.reference ?? extractHomelandReference(description),
    balance:
      input.balanceAfter ?? input.balance ?? undefined,
    raw: input,
  };
}

async function seedSampleInvoices() {
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
  console.log("✓ Sample invoices seeded in MongoDB.");
}

function printTransactionAndMatch(tx, matchResult) {
  console.log("");
  console.log("══════════════════════════════════════════════════════");
  console.log("             GIAO DỊCH BIDV MỚI");
  console.log("══════════════════════════════════════════════════════");
  console.log("");
  console.log(
    tx.direction === "IN"
      ? "🟢 TIỀN VÀO"
      : tx.direction === "OUT"
      ? "🔴 TIỀN RA"
      : "⚪ CHƯA XÁC ĐỊNH"
  );
  console.log("");
  console.log(`Số tiền     : ${money(tx.amount)}`);
  console.log(`Thời gian   : ${tx.transactionTime}`);
  console.log(`Mã GD       : ${tx.externalId}`);
  console.log(`Nội dung    : ${tx.description}`);
  console.log(`Reference   : ${tx.reference || "-"}`);
  if (tx.balance !== undefined) {
    console.log(`Số dư       : ${money(tx.balance)}`);
  }
  console.log(`MongoDB     : ✓ Đã lưu mongo (unique externalId)`);
  console.log("");

  console.log("──────────────────────────────────────────────────────");
  console.log("               ĐỐI SOÁT HOMELAND");
  console.log("──────────────────────────────────────────────────────");

  if (matchResult.status === "MATCHED") {
    const inv = matchResult.invoice;
    console.log(`Reference   : ${tx.reference}`);
    console.log(`Invoice     : ${inv.invoiceCode || inv._id}`);
    console.log(`Phòng       : ${inv.roomCode || inv.roomId || "-"}`);
    console.log(`Khách       : ${inv.tenantName || "-"}`);
    console.log(`Phải thu    : ${money(inv.remainingAmount ?? inv.total)}`);
    console.log(`Đã nhận     : ${money(tx.amount)}`);
    console.log(`Confidence  : ${matchResult.confidence}%`);
    console.log(`Kết quả     : ✅ KHỚP CHÍNH XÁC (${matchResult.reason})`);
    console.log("→ Tự động cập nhật Invoice -> PAID");
  } else if (matchResult.status === "REVIEW") {
    console.log(`Reference   : ${tx.reference || "-"}`);
    console.log(`Lý do       : ${matchResult.reason}`);
    console.log(`Confidence  : ${matchResult.confidence}%`);
    console.log("⚠️ CẦN KẾ TOÁN HOMELAND KIỂM TRA");
  } else {
    console.log(`Status      : ${matchResult.status}`);
    console.log(`Lý do       : ${matchResult.reason}`);
    console.log("⚪ Chưa tìm thấy hóa đơn khớp");
  }

  console.log("══════════════════════════════════════════════════════");
  console.log("");
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/bank-events") {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({ success: false, error: "Not found" })
    );
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", async () => {
    try {
      const payload = JSON.parse(body);
      const tx = normalize(payload);

      // Save to MongoDB with compound unique index (bank + externalId)
      const persistence = await saveTransaction({
        ...tx,
        source: "BIDV_GATEWAY",
      });

      if (persistence.duplicate) {
        console.log(`↪ MongoDB duplicate ignored: ${tx.externalId}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            success: true,
            duplicate: true,
            transactionId: tx.externalId,
          })
        );
      }

      // Run Homeland Reconciliation Matcher
      const matchResult = await reconcileBankTransaction(tx);

      // Update reconciliation status in MongoDB
      await updateReconciliationStatus(tx.externalId, {
        status: matchResult.status,
        invoiceId: matchResult.invoice?._id || null,
        confidence: matchResult.confidence,
        reason: matchResult.reason,
        processedAt: new Date(),
      });

      printTransactionAndMatch(tx, matchResult);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: true,
          transactionId: tx.externalId,
          reference: tx.reference,
          reconciliation: {
            status: matchResult.status,
            confidence: matchResult.confidence,
            reason: matchResult.reason,
          },
        })
      );
    } catch (error) {
      console.error("Gateway Error:", error);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ success: false, error: error.message })
      );
    }
  });
});

async function bootstrap() {
  try {
    console.log("Khởi động Homeland BIDV Gateway...");
    await ensureIndexes();
    await seedSampleInvoices();
    console.log("✓ MongoDB indexes ready");

    server.listen(PORT, () => {
      console.clear();
      console.log(`
══════════════════════════════════════════════════════════════
             HOMELAND • BIDV BANK GATEWAY
══════════════════════════════════════════════════════════════

Gateway      : ● ONLINE
MongoDB      : ● CONNECTED
Bank         : BIDV
Port         : ${PORT}

Endpoint:
POST http://localhost:${PORT}/bank-events

Chờ giao dịch...
`);
    });
  } catch (error) {
    console.error("❌ Không thể khởi động BIDV Gateway", error);
    process.exit(1);
  }
}

bootstrap();
