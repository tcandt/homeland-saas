const fs = require("fs");
const path = require("path");

const roots = [
  path.join(process.cwd(), "apps", "web"),
  path.join(process.cwd(), "apps", "api"),
  path.join(process.cwd(), "packages"),
  path.join(process.cwd(), "scripts"),
];

const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md"]);
const ignoreDirs = new Set(["node_modules", ".next", ".turbo", "dist", "coverage", ".git"]);
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
    if (extensions.has(path.extname(entry.name).toLowerCase())) {
      results.push(full);
    }
  }
  return results;
}

function hasMojibake(text) {
  return markers.some((marker) => text.includes(marker));
}

function score(text) {
  let total = 0;
  for (const marker of markers) {
    total += text.split(marker).length - 1;
  }
  return total;
}

let changedFiles = 0;

for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    const original = fs.readFileSync(file, "utf8");
    if (!hasMojibake(original)) continue;

    const lines = original.split(/\r?\n/);
    const lineFixed = lines
      .map((line) => {
        if (!hasMojibake(line)) return line;
        return Buffer.from(line, "latin1").toString("utf8");
      })
      .join("\n");

    const wholeFixed = Buffer.from(original, "latin1").toString("utf8");

    const candidates = [
      { text: original, score: score(original) },
      { text: lineFixed, score: score(lineFixed) },
      { text: wholeFixed, score: score(wholeFixed) },
    ].sort((a, b) => a.score - b.score);

    const best = candidates[0];
    if (best.text !== original && best.score < score(original)) {
      fs.writeFileSync(file, best.text);
      changedFiles += 1;
    }
  }
}

console.log(`fixed files ${changedFiles}`);

