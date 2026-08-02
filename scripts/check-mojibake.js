const fs = require("fs");
const path = require("path");

const roots = [
  path.join(process.cwd(), "apps", "web"),
  path.join(process.cwd(), "apps", "api"),
  path.join(process.cwd(), "packages"),
  path.join(process.cwd(), "scripts"),
];

const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md"]);
const ignoreDirs = new Set(["node_modules", ".next", ".turbo", "dist", "coverage", ".git", "playwright-report", ".tmp-smoke"]);
const ignoreFiles = new Set(["report.json", "report_permission.json", "performance-results.jsonl"]);

const markers = [
  String.fromCharCode(0xfffd),
  "\u00C3",
  "\u00C2",
  "\u00C4",
  "\u00C6",
  "\u00D0",
  "\u00E1\u00BB",
  "\u0010",
  "\u0011",
  "\u0018",
];

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoreDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
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


