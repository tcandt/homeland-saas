const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ADB =
  process.env.ADB_PATH ||
  path.join(
    process.env.LOCALAPPDATA || "",
    "Android",
    "Sdk",
    "platform-tools",
    "adb.exe"
  );

const SERIAL = process.env.BIDV_DEVICE_SERIAL?.trim();

const REMOTE_XML = "/sdcard/bidv-window.xml";
const LOCAL_DIR = path.resolve(".bidv-ui");
const LOCAL_XML = path.join(LOCAL_DIR, "bidv-window.xml");

function adb(args) {
  return execFileSync(ADB, ["-s", SERIAL, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function decodeXml(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractAttribute(xml, attribute) {
  const regex = new RegExp(`${attribute}="([^"]*)"`, "g");
  const values = [];
  let match;
  while ((match = regex.exec(xml))) {
    const value = decodeXml(match[1]).trim();
    if (value) {
      values.push(value);
    }
  }
  return values;
}

function unique(values) {
  return [...new Set(values)];
}

function looksFinancial(text) {
  const patterns = [
    /\bVND\b/i,
    /\d{1,3}(?:[.,]\d{3})+/,
    /\+\s*\d/,
    /-\s*\d/,
    /giao dịch/i,
    /số dư/i,
    /chuyển tiền/i,
    /nhận tiền/i,
    /thanh toán/i,
    /nội dung/i,
    /\bCK\b/i,
    /\bFT\d+/i,
    /\d{2}\/\d{2}\/\d{4}/,
    /\d{2}:\d{2}/,
  ];
  return patterns.some((pattern) => pattern.test(text));
}

function getForegroundApp() {
  try {
    const output = adb(["shell", "dumpsys", "window"]);
    const lines = output.split(/\r?\n/);
    const focusLine = lines.find(
      (line) => line.includes("mCurrentFocus") || line.includes("mFocusedApp")
    );
    return focusLine ? focusLine.trim() : "com.vnpay.bidv (assumed)";
  } catch (err) {
    return "com.vnpay.bidv (assumed)";
  }
}

function dumpUi() {
  fs.mkdirSync(LOCAL_DIR, { recursive: true });
  try {
    adb(["shell", "rm", "-f", REMOTE_XML]);
  } catch {}
  adb(["shell", "uiautomator", "dump", REMOTE_XML]);
  adb(["pull", REMOTE_XML, LOCAL_XML]);
  return fs.readFileSync(LOCAL_XML, "utf8");
}

function scan() {
  if (!SERIAL) {
    console.error(
      "Thiếu BIDV_DEVICE_SERIAL. Hãy cấu hình mã thiết bị trong môi trường cục bộ."
    );
    process.exitCode = 1;
    return;
  }

  console.clear();
  console.log("══════════════════════════════════════════════════════════════");
  console.log("           HOMELAND • BIDV APP TERMINAL");
  console.log("══════════════════════════════════════════════════════════════\n");
  console.log(`Device : ${SERIAL}`);
  console.log(`ADB    : ${ADB}`);

  const focus = getForegroundApp();
  console.log(`Focus  : ${focus}\n`);

  if (!focus.includes("com.vnpay.bidv") && !focus.includes("assumed")) {
    console.log("⚠ BIDV hiện không nằm foreground.");
    console.log("Hãy mở BIDV → Lịch sử giao dịch.");
    return;
  }

  let xml;
  try {
    xml = dumpUi();
  } catch (error) {
    console.error("❌ Không dump được UI hierarchy.");
    console.error(error.stderr || error.message);
    return;
  }

  const texts = extractAttribute(xml, "text");
  const descriptions = extractAttribute(xml, "content-desc");
  const all = unique([...texts, ...descriptions]);
  const financial = all.filter(looksFinancial);

  console.log(`UI nodes có text      : ${all.length}`);
  console.log(`Dòng nghi giao dịch   : ${financial.length}\n`);

  if (!all.length) {
    console.log("❌ BIDV không expose text qua UI hierarchy.");
    return;
  }

  console.log("──────────────────────────────────────────────────────────────");
  console.log(" TEXT APP BIDV");
  console.log("──────────────────────────────────────────────────────────────");

  all.forEach((text, index) => {
    const marker = financial.includes(text) ? "🟢" : "  ";
    console.log(`${marker} ${String(index + 1).padStart(3, "0")} | ${text}`);
  });

  console.log("");
  if (financial.length) {
    console.log("══════════════════════════════════════════════════════════════");
    console.log("     ✓ ĐÃ ĐỌC ĐƯỢC DỮ LIỆU BIDV TỪ APP");
    console.log("══════════════════════════════════════════════════════════════");
  } else {
    console.log("⚠️ Tìm thấy text trên UI nhưng chưa có dòng thông tin tài chính/giao dịch.");
  }
}

scan();
