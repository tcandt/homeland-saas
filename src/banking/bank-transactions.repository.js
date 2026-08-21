const { getDatabase } = require("./mongodb");

async function ensureIndexes() {
  const db = await getDatabase();
  const collection = db.collection("bank_transactions");

  await collection.createIndex(
    { bank: 1, externalId: 1 },
    { unique: true, name: "unique_bank_external_id" }
  );

  await collection.createIndex(
    { transactionTime: -1 },
    { name: "transaction_time_desc" }
  );

  await collection.createIndex(
    { reference: 1 },
    { name: "payment_reference" }
  );

  await collection.createIndex(
    { "reconciliation.status": 1 },
    { name: "reconciliation_status" }
  );
}

async function saveTransaction(tx) {
  const db = await getDatabase();
  const collection = db.collection("bank_transactions");
  const now = new Date();

  const document = {
    bank: tx.bank || "BIDV",
    externalId: String(tx.externalId),
    accountId: tx.accountId || "BIDV_MAIN",
    direction: tx.direction,
    amount: Number(tx.amount),
    currency: tx.currency || "VND",
    transactionTime: new Date(tx.transactionTime),
    description: tx.description || "",
    reference: tx.reference || null,
    balance: tx.balance ?? null,
    source: tx.source || "BIDV_GATEWAY",
    reconciliation: tx.reconciliation || {
      status: "UNMATCHED",
      invoiceId: null,
      paymentId: null,
      confidence: 0,
      reason: null,
      processedAt: null,
    },
    raw: tx.raw || null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.updateOne(
    {
      bank: document.bank,
      externalId: document.externalId,
    },
    {
      $setOnInsert: document,
    },
    {
      upsert: true,
    }
  );

  return {
    inserted: result.upsertedCount === 1,
    duplicate: result.upsertedCount === 0,
    id: result.upsertedId || null,
  };
}

async function updateReconciliationStatus(externalId, reconciliationData) {
  const db = await getDatabase();
  const collection = db.collection("bank_transactions");

  return collection.updateOne(
    { bank: "BIDV", externalId: String(externalId) },
    {
      $set: {
        reconciliation: reconciliationData,
        updatedAt: new Date(),
      },
    }
  );
}

async function getTransaction(externalId) {
  const db = await getDatabase();
  return db.collection("bank_transactions").findOne({
    bank: "BIDV",
    externalId: String(externalId),
  });
}

module.exports = {
  ensureIndexes,
  saveTransaction,
  updateReconciliationStatus,
  getTransaction,
};
