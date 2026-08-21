const fs = require("fs");

const file = process.argv[2];

if (!file) {
  console.error(`
Cách chạy:

node scripts/bidv-events-terminal.js httptoolkit-events.json
`);
  process.exit(1);
}

const raw = JSON.parse(
  fs.readFileSync(file, "utf8")
);

const events =
  raw?.data?.events ??
  raw?.events ??
  [];

const IGNORE = [
  "google.com",
  "googleapis.com",
  "gstatic.com",
  "crashlytics.com",
  "firebase",
  "appsflyer",
  "httptoolkit",
  "connectivitycheck"
];

const PRIORITY = [
  "bidv",
  "vnpay",
  "omni"
];

const TX_HINTS = [
  "transaction",
  "history",
  "statement",
  "account",
  "balance",
  "inquiry",
  "movement",
  "ledger",
  "transfer"
];

function ignored(url = "") {
  const x = url.toLowerCase();

  return IGNORE.some(
    item => x.includes(item)
  );
}

function priority(url = "") {
  const x = url.toLowerCase();

  return PRIORITY.some(
    item => x.includes(item)
  );
}

function scoreUrl(url = "") {
  const x = url.toLowerCase();

  let score = 0;

  for (const word of TX_HINTS) {
    if (x.includes(word)) {
      score++;
    }
  }

  return score;
}

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

console.clear();

console.log(`
════════════════════════════════════════════════════════════════
              HOMELAND • BIDV NETWORK TERMINAL
════════════════════════════════════════════════════════════════
`);

console.log(
  `Tổng event HTTP Toolkit : ${events.length}`
);

const useful =
  events
    .filter(e => {
      const url =
        e.url ??
        e.request?.url ??
        "";

      return (
        url &&
        !ignored(url) &&
        priority(url)
      );
    })
    .map((event, index) => {

      const urlText =
        event.url ??
        event.request?.url ??
        "";

      const u =
        safeUrl(urlText);

      return {
        event,
        index: index + 1,

        method:
          event.method ??
          event.request?.method ??
          "-",

        status:
          event.statusCode ??
          event.status ??
          event.response?.status ??
          "-",

        host:
          u?.hostname ?? "-",

        path:
          u?.pathname ?? urlText,

        score:
          scoreUrl(urlText)
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score
    );

console.log(
  `BIDV/VNPAY event       : ${useful.length}`
);

console.log("");

if (!useful.length) {

  console.log(
    "Không tìm thấy event BIDV/VNPAY."
  );

  process.exit(0);
}

console.table(
  useful.map(item => ({
    "#": item.index,

    Method:
      item.method,

    Status:
      item.status,

    Host:
      item.host,

    Path:
      item.path,

    "TX Score":
      item.score
  }))
);

/* ------------------------------------------------ */
/* Thử dò body JSON                                  */
/* ------------------------------------------------ */

function getResponseBody(event) {

  return (
    event.response?.body ??
    event.responseBody ??
    event.body ??
    event.response?.content?.text ??
    null
  );
}

function parseBody(body) {

  if (!body) {
    return null;
  }

  if (
    typeof body === "object"
  ) {
    return body;
  }

  if (
    typeof body !== "string"
  ) {
    return null;
  }

  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

const FIELD_HINTS = [
  "amount",
  "transaction",
  "transid",
  "transactionid",
  "credit",
  "debit",
  "description",
  "remark",
  "balance",
  "reference",
  "content"
];

function jsonScore(value) {

  try {

    const text =
      JSON.stringify(value)
        .toLowerCase();

    let score = 0;

    for (const word of FIELD_HINTS) {

      if (
        text.includes(word)
      ) {
        score++;
      }
    }

    return score;

  } catch {
    return 0;
  }
}

console.log(`
════════════════════════════════════════════════════════════════
                 KIỂM TRA RESPONSE JSON
════════════════════════════════════════════════════════════════
`);

let jsonCount = 0;

for (const item of useful) {

  const body =
    getResponseBody(
      item.event
    );

  const json =
    parseBody(body);

  if (!json) {
    continue;
  }

  jsonCount++;

  const score =
    jsonScore(json);

  console.log(
    `\n[${item.index}] ${item.method} ${item.host}${item.path}`
  );

  console.log(
    `JSON score: ${score}`
  );

  if (score >= 3) {

    console.log(
      "🟢 CÓ DẤU HIỆU RESPONSE GIAO DỊCH"
    );

    console.dir(
      json,
      {
        depth: 5,
        colors: true
      }
    );

  } else {

    console.log(
      "Response JSON nhưng chưa giống lịch sử giao dịch."
    );
  }
}

console.log(`
════════════════════════════════════════════════════════════════
                         KẾT QUẢ
════════════════════════════════════════════════════════════════
`);

console.log(
  `JSON đọc được: ${jsonCount}`
);

if (!jsonCount) {

  console.log(`
⚠ Không có response JSON được giải mã.

Nếu các event tương ứng hiển thị:

Certificate rejected

thì HTTP Toolkit hiện chỉ thấy kết nối TLS,
không thấy payload bên trong.
`);
}
