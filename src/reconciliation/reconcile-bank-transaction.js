const { getDatabase } = require("../banking/mongodb");

async function reconcileBankTransaction(transaction) {
  const db = await getDatabase();

  if (transaction.direction !== "IN") {
    return {
      status: "IGNORED",
      confidence: 0,
      reason: "OUTGOING_TRANSACTION",
    };
  }

  if (!transaction.reference) {
    return {
      status: "REVIEW",
      confidence: 0,
      reason: "MISSING_PAYMENT_REFERENCE",
    };
  }

  const invoice = await db.collection("invoices").findOne({
    paymentReference: transaction.reference,
    status: { $in: ["UNPAID", "PARTIAL"] },
  });

  if (!invoice) {
    return {
      status: "UNMATCHED",
      confidence: 0,
      reason: "INVOICE_NOT_FOUND",
    };
  }

  const remaining = Number(invoice.remainingAmount ?? invoice.total ?? 0);
  const amount = Number(transaction.amount);

  if (amount === remaining) {
    return {
      status: "MATCHED",
      confidence: 100,
      reason: "REFERENCE_AND_AMOUNT_EXACT",
      invoice,
    };
  }

  if (amount < remaining) {
    return {
      status: "MATCHED",
      confidence: 95,
      reason: "REFERENCE_PARTIAL_PAYMENT",
      invoice,
    };
  }

  if (amount > remaining) {
    return {
      status: "REVIEW",
      confidence: 90,
      reason: "REFERENCE_OVERPAYMENT",
      invoice,
    };
  }

  return {
    status: "REVIEW",
    confidence: 0,
    reason: "UNKNOWN",
  };
}

module.exports = {
  reconcileBankTransaction,
};
