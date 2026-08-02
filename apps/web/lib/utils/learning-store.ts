import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_LIMIT_BYTES = 100 * 1024 * 1024;
const SNAPSHOT_LIMIT = 600;
const FORBIDDEN_KEYS = new Set([
  "image",
  "images",
  "blob",
  "file",
  "base64",
  "dataurl",
  "datauri",
  "qrtext",
  "qrpayload",
  "payloadtext",
  "rawqr",
  "processedimage",
]);

function finite(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

function rejectSensitiveFields(value: any, depth = 0): void {
  if (depth > 5 || value == null) return;
  if (typeof value === "string") {
    if (/^data:image\//i.test(value) || value.length > 512)
      throw new TypeError("Image, QR content and large strings are not accepted");
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) rejectSensitiveFields(item, depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase()))
      throw new TypeError(`Field '${key}' is not accepted`);
    rejectSensitiveFields(item, depth + 1);
  }
}

function exactKeys(value: Record<string, any>, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

export function sanitizeLearningSample(kind: string, input: any): any {
  rejectSensitiveFields(input);
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new TypeError("Learning sample must be an object");

  if (kind === "corner") {
    const allowed = new Set(["deltas", "feature", "movement", "at", "source"]);
    if (!exactKeys(input, allowed))
      throw new TypeError("Unknown corner learning field");
    if (
      input.source !== "manual-confirmed" ||
      !Array.isArray(input.deltas) ||
      input.deltas.length !== 4
    ) throw new TypeError("Corner sample requires four confirmed deltas");
    const deltas = input.deltas.map((point: any) => {
      const x = Number(point?.x);
      const y = Number(point?.y);
      if (!finite(x, -0.35, 0.35) || !finite(y, -0.35, 0.35))
        throw new RangeError("Corner delta is outside the accepted range");
      return { x, y };
    });
    const feature = input.feature;
    const featureKeys = new Set(["ratio", "area", "cx", "cy", "tilt", "width", "height"]);
    if (!feature || typeof feature !== "object" || !exactKeys(feature, featureKeys))
      throw new TypeError("Invalid corner feature vector");
    const sanitizedFeature = {
      ratio: Number(feature.ratio),
      area: Number(feature.area),
      cx: Number(feature.cx),
      cy: Number(feature.cy),
      tilt: Number(feature.tilt),
      width: Number(feature.width),
      height: Number(feature.height),
    };
    if (
      !finite(sanitizedFeature.ratio, 1, 3) ||
      !finite(sanitizedFeature.area, 0.01, 1) ||
      !finite(sanitizedFeature.cx, 0, 1) ||
      !finite(sanitizedFeature.cy, 0, 1) ||
      !finite(sanitizedFeature.tilt, -1, 1) ||
      !finite(sanitizedFeature.width, 1, 10000) ||
      !finite(sanitizedFeature.height, 1, 10000)
    ) throw new RangeError("Corner feature is outside the accepted range");
    const movement = Number(input.movement);
    if (!finite(movement, 0.002, 0.2))
      throw new RangeError("Corner correction movement is outside the accepted range");
    return {
      deltas,
      feature: sanitizedFeature,
      movement,
      at: Date.now(),
      source: "manual-confirmed",
    };
  }

  if (kind === "qr") {
    const allowed = new Set(["x", "y", "span", "at", "source"]);
    if (!exactKeys(input, allowed))
      throw new TypeError("Unknown QR learning field");
    const source = String(input.source || "");
    if (
      !/^[a-z0-9 _:+.-]{1,80}$/i.test(source) ||
      /^(texture|learned|unknown)$/i.test(source)
    )
      throw new TypeError("QR sample must come from a verified decoder or finder");
    const x = Number(input.x);
    const y = Number(input.y);
    const span = Number(input.span);
    if (!finite(x, 0.65, 1) || !finite(y, 0, 0.5) || !finite(span, 0.03, 0.4))
      throw new RangeError("QR prior is outside the accepted range");
    return { x, y, span, at: Date.now(), source };
  }

  throw new TypeError("Unsupported learning sample kind");
}

function fingerprint(kind: string, payload: any): string {
  const stable = kind === "corner"
    ? {
        kind,
        feature: Object.fromEntries(
          Object.entries(payload.feature).map(([key, value]) => [
            key,
            Number(value).toFixed(key === "width" || key === "height" ? 1 : 4),
          ]),
        ),
        deltas: payload.deltas.map(({ x, y }: { x: number; y: number }) => [
          Number(x).toFixed(4),
          Number(y).toFixed(4),
        ]),
      }
    : {
        kind,
        x: Number(payload.x).toFixed(4),
        y: Number(payload.y).toFixed(4),
        span: Number(payload.span).toFixed(4),
        source: payload.source,
      };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

function rowBytes(row: any): number {
  return Buffer.byteLength(`${JSON.stringify(row)}\n`);
}

export interface LearningStoreOptions {
  dataDir?: string;
  maxBytes?: number;
}

export async function createLearningStore(options: LearningStoreOptions = {}) {
  const dataDir = path.resolve(
    options.dataDir ||
      process.env.CCCD_LEARNING_DATA_DIR ||
      path.join(process.cwd(), ".local-data", "learning"),
  );
  const configuredLimit = Number(
    options.maxBytes || process.env.CCCD_LEARNING_MAX_BYTES || DEFAULT_LIMIT_BYTES,
  );
  const maxBytes = Number.isFinite(configuredLimit)
    ? Math.max(1024 * 1024, Math.min(DEFAULT_LIMIT_BYTES, configuredLimit))
    : DEFAULT_LIMIT_BYTES;
  const filePath = path.join(dataDir, "samples.ndjson");
  await mkdir(dataDir, { recursive: true });

  let rows: any[] = [];
  try {
    const content = await readFile(filePath, "utf8");
    rows = content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((row) =>
        row &&
        (row.kind === "corner" || row.kind === "qr") &&
        typeof row.id === "string" &&
        row.payload);
  } catch {
    rows = [];
  }

  let usedBytes = rows.reduce((sum, row) => sum + rowBytes(row), 0);
  let revision = rows.reduce((max, row) => Math.max(max, Number(row.revision || 0)), 0);
  let recentIds = new Set<string>(rows.slice(-20000).map((row) => row.id));
  let writeQueue = Promise.resolve();

  async function compactIfNeeded() {
    if (usedBytes <= maxBytes) return;
    const target = maxBytes * 0.92;
    while (rows.length && usedBytes > target) {
      const removed = rows.shift();
      usedBytes -= rowBytes(removed);
    }
    const tempPath = `${filePath}.tmp`;
    await writeFile(
      tempPath,
      rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""),
      "utf8",
    );
    await rename(tempPath, filePath);
    recentIds = new Set<string>(rows.slice(-20000).map((row) => row.id));
    try {
      usedBytes = (await stat(filePath)).size;
    } catch {
      usedBytes = rows.reduce((sum, row) => sum + rowBytes(row), 0);
    }
  }

  async function addMany(samples: any[]) {
    const accepted: any[] = [];
    const duplicates: string[] = [];
    let rejected = 0;
    let nextRevision = revision;
    for (const entry of samples) {
      let kind;
      let payload;
      let id;
      try {
        kind = entry?.kind;
        payload = sanitizeLearningSample(kind, entry?.payload);
        id = fingerprint(kind, payload);
        if (recentIds.has(id)) {
          duplicates.push(id);
          continue;
        }
      } catch {
        rejected += 1;
        continue;
      }
      nextRevision += 1;
      const row = {
        id,
        kind,
        payload,
        receivedAt: Date.now(),
        revision: nextRevision,
      };
      recentIds.add(id);
      accepted.push(row);
    }
    if (!accepted.length)
      return { accepted: 0, duplicates: duplicates.length, rejected };
    writeQueue = writeQueue.catch(() => {}).then(async () => {
      await appendFile(
        filePath,
        accepted.map((row) => `${JSON.stringify(row)}\n`).join(""),
        "utf8",
      );
      for (const row of accepted) {
        rows.push(row);
        usedBytes += rowBytes(row);
        revision = Math.max(revision, Number(row.revision || 0));
      }
      await compactIfNeeded();
    });
    try {
      await writeQueue;
    } catch (error) {
      for (const row of accepted) recentIds.delete(row.id);
      throw error;
    }
    return { accepted: accepted.length, duplicates: duplicates.length, rejected };
  }

  function snapshot() {
    const corner = rows
      .filter((row) => row.kind === "corner")
      .slice(-SNAPSHOT_LIMIT)
      .map((row) => row.payload);
    const qr = rows
      .filter((row) => row.kind === "qr")
      .slice(-SNAPSHOT_LIMIT)
      .map((row) => row.payload);
    return {
      revision,
      limitBytes: maxBytes,
      usedBytes,
      corner,
      qr,
      counts: {
        corner: rows.filter((row) => row.kind === "corner").length,
        qr: rows.filter((row) => row.kind === "qr").length,
      },
      storage: "server",
      storesImages: false,
      storesQrPayload: false,
      dataDir,
      filePath,
    };
  }

  return { addMany, snapshot, dataDir, filePath };
}

let globalStorePromise: ReturnType<typeof createLearningStore> | null = null;
export function getLearningStore() {
  if (!globalStorePromise) {
    globalStorePromise = createLearningStore();
  }
  return globalStorePromise;
}
