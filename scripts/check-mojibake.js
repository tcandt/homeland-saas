const fs = require("fs");
const path = require("path");

const roots = [
  path.join(process.cwd(), "apps", "web"),
  path.join(process.cwd(), "apps", "api"),
  path.join(process.cwd(), "packages"),
  path.join(process.cwd(), "scripts"),
];

const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md"]);
const ignoreDirs = new Set(["node_modules", ".next", ".turbo", "dist", "coverage", ".git", ".auth", "playwright-report", "test-results", ".tmp-smoke", ".tmp-production-verify"]);
const ignoreFiles = new Set(["report.json", "report_permission.json", "performance-results.jsonl", "opencv.js"]);

const markers = [
  String.fromCharCode(0xfffd),
  "\u00c3\u00a1",
  "\u00c3\u00a0",
  "\u00c3\u00a2",
  "\u00c3\u00a3",
  "\u00c3\u00a8",
  "\u00c3\u00a9",
  "\u00c3\u00aa",
  "\u00c3\u00ac",
  "\u00c3\u00ad",
  "\u00c3\u00b2",
  "\u00c3\u00b3",
  "\u00c3\u00b4",
  "\u00c3\u00b5",
  "\u00c3\u00b9",
  "\u00c3\u00ba",
  "\u00c3\u00bd",
  "\u00c4\u2018",
  "\u00c4\u0090",
  "\u00c6\u00a1",
  "\u00c6\u00b0",
  "\u00e1\u00ba",
  "\u00e1\u00bb",
  "\u00c2\u00b7",
  "\u00c2\u00a0",
  "\u00e2\u20ac",
  "\u00ef\u00bf\u00bd",
  "\u0054\u0068\u1ed2",
  "\u0010",
  "\u0011",
  "\u0018",
];

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoreDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (full.includes(`${path.sep}public${path.sep}qr${path.sep}assets${path.sep}`)) continue;
    if (entry.isDirectory()) {
      walk(full, results);
      continue;
    }
    if (ignoreFiles.has(entry.name)) continue;
    if (extensions.has(path.extname(entry.name).toLowerCase())) {
      results.push(full);
    }
  }
  return results;
}

function hasMojibake(line) {
  return markers.some((marker) => line.includes(marker));
}

const findings = [];

for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (hasMojibake(line)) {
        findings.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    });
  }
}

if (findings.length > 0) {
  console.error("Mojibake detected:");
  for (const finding of findings.slice(0, 100)) {
    console.error(`- ${finding}`);
  }
  if (findings.length > 100) {
    console.error(`... and ${findings.length - 100} more`);
  }
  process.exit(1);
}

console.log("No mojibake detected.");
