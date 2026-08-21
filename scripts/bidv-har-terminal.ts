import fs from "node:fs/promises";
import path from "node:path";

interface HarHeader {
  name?: string;
  value?: string;
}

interface HarEntry {
  startedDateTime?: string;
  request?: {
    method?: string;
    url?: string;
    headers?: HarHeader[];
    queryString?: Array<{
      name?: string;
      value?: string;
    }>;
    postData?: {
      mimeType?: string;
      text?: string;
    };
  };
  response?: {
    status?: number;
    statusText?: string;
    headers?: HarHeader[];
    content?: {
      mimeType?: string;
      text?: string;
      encoding?: string;
    };
  };
}

interface HarFile {
  log?: {
    entries?: HarEntry[];
  };
}

interface NormalizedTransaction {
  id: string;
  time: string;
  direction: "IN" | "OUT" | "UNKNOWN";
  amount: number;
  description: string;
  balance?: number;
  raw: Record<string, unknown>;
}

const BANK_HOST_PATTERNS = [/bidv/i, /vnpay/i];

const IGNORE_PATTERNS = [
  /crashlytics/i,
  /firebase/i,
  /appsflyer/i,
  /connectivitycheck/i,
  /googleapis/i,
  /google\.com/i,
  /analytics/i,
  /launches/i,
  /event/i,
  /telemetry/i,
];

const TRANSACTION_URL_HINTS = [
  "transaction",
  "transactions",
  "history",
  "statement",
  "account",
  "account-history",
  "transaction-history",
  "inquiry",
  "movement",
  "balance",
  "activity",
  "ledger",
];

const TRANSACTION_FIELD_HINTS = [
  "transaction",
  "transactionid",
  "transactiondate",
  "transid",
  "transdate",
  "trancode",
  "amount",
  "creditamount",
  "debitamount",
  "description",
  "remark",
  "content",
  "balance",
  "runningbalance",
  "reference",
  "refno",
  "credit",
  "debit",
];

function getUrl(entry: HarEntry) {
  return entry.request?.url ?? "";
}

function isBankCandidate(entry: HarEntry) {
  const url = getUrl(entry);
  if (!BANK_HOST_PATTERNS.some((pattern) => pattern.test(url))) {
    return false;
  }
  if (IGNORE_PATTERNS.some((pattern) => pattern.test(url))) {
    return false;
  }
  return true;
}

function getResponseText(entry: HarEntry): string | null {
  const content = entry.response?.content;
  if (!content?.text) {
    return null;
  }
  if (content.encoding === "base64") {
    try {
      return Buffer.from(content.text, "base64").toString("utf8");
    } catch {
      return null;
    }
  }
  return content.text;
}

function parseJson(text: string | null): unknown {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeKey(key: string) {
  return key.replace(/[_\-\s]/g, "").toLowerCase();
}

function parseNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value !== "string") {
    return 0;
  }
  const normalized = value.replace(/[^\d,.\-+]/g, "").trim();
  if (!normalized) {
    return 0;
  }
  const clean = normalized
    .replace(/[,.](?=\d{3}(?:[,.]|$))/g, "")
    .replace(",", ".");
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
}

function formatMoney(value: number) {
  return value.toLocaleString("vi-VN") + " ₫";
}

function maskSensitiveValue(name: string, value: string) {
  const lower = name.toLowerCase();
  if (
    lower.includes("authorization") ||
    lower.includes("token") ||
    lower.includes("cookie") ||
    lower.includes("secret") ||
    lower.includes("session")
  ) {
    return "<REDACTED>";
  }
  return value;
}

function objectTransactionScore(value: Record<string, unknown>) {
  const keys = Object.keys(value).map(normalizeKey);
  let score = 0;
  for (const hint of TRANSACTION_FIELD_HINTS) {
    if (keys.some((key) => key.includes(hint))) {
      score++;
    }
  }
  return score;
}

function looksLikeTransactionObject(
  value: unknown
): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return objectTransactionScore(value as Record<string, unknown>) >= 3;
}

function findTransactionObjects(
  value: unknown,
  results: Record<string, unknown>[] = [],
  depth = 0
) {
  if (depth > 12) {
    return results;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      findTransactionObjects(item, results, depth + 1);
    }
    return results;
  }
  if (!value || typeof value !== "object") {
    return results;
  }
  const object = value as Record<string, unknown>;
  if (looksLikeTransactionObject(object)) {
    results.push(object);
  }
  for (const child of Object.values(object)) {
    if (typeof child === "object" && child !== null) {
      findTransactionObjects(child, results, depth + 1);
    }
  }
  return results;
}

function pick(
  object: Record<string, unknown>,
  candidates: string[]
): unknown {
  const entries = Object.entries(object);
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeKey(candidate);
    const found = entries.find(
      ([key]) => normalizeKey(key) === normalizedCandidate
    );
    if (found) {
      return found[1];
    }
  }
  return undefined;
}

function determineDirection(
  tx: Record<string, unknown>
): "IN" | "OUT" | "UNKNOWN" {
  const credit = parseNumber(
    pick(tx, ["creditAmount", "credit", "creditAmt"])
  );
  const debit = parseNumber(pick(tx, ["debitAmount", "debit", "debitAmt"]));

  if (credit > 0) return "IN";
  if (debit > 0) return "OUT";

  const type = String(
    pick(tx, [
      "type",
      "transactionType",
      "direction",
      "drCr",
      "dcSign",
      "creditDebit",
    ]) ?? ""
  )
    .toUpperCase()
    .trim();

  if (
    type.includes("CREDIT") ||
    type === "CR" ||
    type === "C" ||
    type === "IN" ||
    type.includes("GHI CO") ||
    type.includes("GHI CÓ")
  ) {
    return "IN";
  }

  if (
    type.includes("DEBIT") ||
    type === "DR" ||
    type === "D" ||
    type === "OUT" ||
    type.includes("GHI NO") ||
    type.includes("GHI NỢ")
  ) {
    return "OUT";
  }

  const rawAmount = pick(tx, ["amount", "transactionAmount", "transAmount"]);
  if (typeof rawAmount === "number") {
    if (rawAmount > 0) return "IN";
    if (rawAmount < 0) return "OUT";
  }
  if (typeof rawAmount === "string") {
    const value = rawAmount.trim();
    if (value.startsWith("+")) return "IN";
    if (value.startsWith("-")) return "OUT";
  }

  return "UNKNOWN";
}

function getAmount(
  tx: Record<string, unknown>,
  direction: "IN" | "OUT" | "UNKNOWN"
) {
  if (direction === "IN") {
    const credit = parseNumber(
      pick(tx, ["creditAmount", "creditAmt", "credit"])
    );
    if (credit) return credit;
  }

  if (direction === "OUT") {
    const debit = parseNumber(
      pick(tx, ["debitAmount", "debitAmt", "debit"])
    );
    if (debit) return debit;
  }

  return parseNumber(
    pick(tx, ["amount", "transactionAmount", "transAmount", "amt", "value"])
  );
}

function normalizeTransaction(
  tx: Record<string, unknown>,
  index: number
): NormalizedTransaction {
  const direction = determineDirection(tx);
  const amount = getAmount(tx, direction);

  const id = String(
    pick(tx, [
      "transactionId",
      "transId",
      "transactionNo",
      "referenceNo",
      "refNo",
      "id",
    ]) ?? `UNKNOWN-${index}`
  );

  const time = String(
    pick(tx, [
      "transactionDate",
      "transactionTime",
      "transDate",
      "transTime",
      "postedAt",
      "date",
      "bookingDate",
      "valueDate",
    ]) ?? ""
  );

  const description = String(
    pick(tx, [
      "description",
      "remark",
      "content",
      "transactionDescription",
      "narrative",
      "details",
      "memo",
    ]) ?? ""
  );

  const balance = parseNumber(
    pick(tx, [
      "balance",
      "runningBalance",
      "availableBalance",
      "balanceAfter",
    ])
  );

  return {
    id,
    time,
    direction,
    amount,
    description,
    balance: balance || undefined,
    raw: tx,
  };
}

async function main() {
  const filename = process.argv[2];
  if (!filename) {
    console.error(`
Sử dụng:
  npx tsx scripts/bidv-har-terminal.ts ./capture-bidv.har
`);
    process.exit(1);
  }

  const absolute = path.resolve(filename);
  console.log("\n════════════════════════════════════════════════════════════");
  console.log(" HOMELAND • BIDV TRANSACTION SCANNER");
  console.log("════════════════════════════════════════════════════════════\n");
  console.log(`HAR: ${absolute}\n`);

  const file = await fs.readFile(absolute, "utf8");
  const har = JSON.parse(file) as HarFile;
  const entries = har.log?.entries ?? [];
  const bankEntries = entries.filter(isBankCandidate);

  let jsonResponses = 0;
  const candidateResponses: Array<{
    entry: HarEntry;
    data: unknown;
    transactions: Record<string, unknown>[];
  }> = [];

  for (const entry of bankEntries) {
    const text = getResponseText(entry);
    const json = parseJson(text);
    if (!json) continue;

    jsonResponses++;
    const transactions = findTransactionObjects(json);
    const url = getUrl(entry).toLowerCase();
    const urlLooksInteresting = TRANSACTION_URL_HINTS.some((hint) =>
      url.includes(hint)
    );

    if (transactions.length > 0 || urlLooksInteresting) {
      candidateResponses.push({
        entry,
        data: json,
        transactions,
      });
    }
  }

  console.log(`✓ Tổng request        : ${entries.length}`);
  console.log(`✓ BIDV/VNPAY request  : ${bankEntries.length}`);
  console.log(`✓ JSON response       : ${jsonResponses}`);
  console.log(`✓ Candidate response  : ${candidateResponses.length}\n`);

  if (!candidateResponses.length) {
    console.log("⚠ Không tìm thấy response JSON có dấu hiệu giao dịch.\n");
    console.log("Các request BIDV/VNPAY nhìn thấy:\n");
    console.table(
      bankEntries.map((entry, index) => {
        const url = new URL(getUrl(entry));
        return {
          "#": index + 1,
          status: entry.response?.status ?? "-",
          method: entry.request?.method ?? "-",
          host: url.hostname,
          path: url.pathname,
        };
      })
    );
    console.log("\nNếu HTTP Toolkit đang hiện 'Certificate rejected',");
    console.log("request đó sẽ không có decrypted response JSON để đọc.");
    return;
  }

  const outputDir = path.resolve(".bidv-debug");
  await fs.mkdir(outputDir, { recursive: true });
  const allTransactions: NormalizedTransaction[] = [];

  for (let i = 0; i < candidateResponses.length; i++) {
    const candidate = candidateResponses[i];
    const request = candidate.entry.request;
    const response = candidate.entry.response;
    const url = request?.url ?? "";

    console.log("────────────────────────────────────────────────────────────");
    console.log(
      `[${String(i + 1).padStart(2, "0")}] ` +
        `${response?.status ?? "-"} ` +
        `${request?.method ?? "-"}`
    );
    console.log(url + "\n");

    const safeHeaders = Object.fromEntries(
      (request?.headers ?? []).map((header) => [
        header.name ?? "",
        maskSensitiveValue(header.name ?? "", header.value ?? ""),
      ])
    );

    const debugData = {
      request: {
        method: request?.method,
        url,
        headers: safeHeaders,
        queryString: request?.queryString,
        postDataMimeType: request?.postData?.mimeType,
      },
      response: {
        status: response?.status,
        mimeType: response?.content?.mimeType,
        body: candidate.data,
      },
    };

    const debugFile = path.join(
      outputDir,
      `candidate-${String(i + 1).padStart(2, "0")}.json`
    );
    await fs.writeFile(debugFile, JSON.stringify(debugData, null, 2), "utf8");

    console.log(`Candidate transaction objects: ${candidate.transactions.length}`);

    if (candidate.transactions.length) {
      const normalized = candidate.transactions.map((tx, txIndex) =>
        normalizeTransaction(tx, txIndex)
      );
      allTransactions.push(...normalized);
    }
  }

  console.log("\n════════════════════════════════════════════════════════════");
  console.log(" GIAO DỊCH TÌM THẤY");
  console.log("════════════════════════════════════════════════════════════\n");

  if (!allTransactions.length) {
    console.log("Chưa tự nhận diện được object transaction.");
    console.log(`Hãy xem JSON trong: ${outputDir}`);
    return;
  }

  const unique = new Map<string, NormalizedTransaction>();
  for (const transaction of allTransactions) {
    const key = [
      transaction.id,
      transaction.time,
      transaction.amount,
      transaction.description,
    ].join("|");
    if (!unique.has(key)) {
      unique.set(key, transaction);
    }
  }

  const transactions = [...unique.values()];
  console.table(
    transactions.map((tx) => ({
      "Thời gian": tx.time,
      Loại:
        tx.direction === "IN"
          ? "TIỀN VÀO"
          : tx.direction === "OUT"
          ? "TIỀN RA"
          : "CHƯA RÕ",
      "Số tiền": formatMoney(tx.amount),
      "Nội dung": tx.description.slice(0, 80),
      "Mã GD": tx.id.slice(0, 32),
      "Số dư": tx.balance ? formatMoney(tx.balance) : "",
    }))
  );

  console.log(`\n✓ Đã tìm thấy ${transactions.length} giao dịch`);
  console.log(`✓ Debug JSON: ${outputDir}\n`);
}

main().catch((error) => {
  console.error("\n❌ BIDV HAR SCANNER ERROR", error);
  process.exit(1);
});
