import { BrowserQRCodeReader } from "@zxing/browser";
import jsQR from "jsqr";

export type CccdQrDraft = {
  fullName: string;
  phone: string;
  citizenId: string;
  gender: string;
  birthDate: string;
  nationality: string;
  address: string;
};

export type CropRect = { x: number; y: number; width: number; height: number };

export type CccdQrScanProgress = {
  step: number;
  total: number;
  phase: "loading" | "full-image" | "searching" | "enhancing" | "rotating" | "analyzing-ai" | "decoded" | "failed";
  scanningCrop?: CropRect;
  detectedQrBounds?: CropRect;
  failureReason?: QrFailureReason;
};

export type QrFailureReason = "qr-not-found" | "image-blurry" | "glare-detected" | "insufficient-resolution" | "too-dark" | "unsupported-qr" | "timeout" | "ai-failed" | "ai-timeout";

export const QR_FAILURE_MESSAGES: Record<QrFailureReason, string> = {
  "qr-not-found": "Không tìm thấy QR. Hãy đưa riêng mã QR trên CCCD vào gần camera hơn.",
  "image-blurry": "Ảnh bị mờ. Hãy giữ máy ổn định và chạm để lấy nét vào QR.",
  "glare-detected": "Ảnh bị phản sáng. Hãy nghiêng nhẹ CCCD rồi chụp lại.",
  "insufficient-resolution": "QR trong ảnh có độ phân giải thấp. Hãy chụp ảnh mới thay vì dùng ảnh đã gửi qua ứng dụng chat.",
  "too-dark": "Ảnh quá tối. Cần thêm ánh sáng để đọc mã QR.",
  "unsupported-qr": "Mã QR không chứa dữ liệu CCCD hợp lệ.",
  "timeout": "Chưa đọc được mã. Hãy quét trực tiếp và đưa camera lại gần QR hơn.",
  "ai-failed": "Không thể trích xuất thông tin qua AI. Xin vui lòng thử lại bằng ảnh rõ nét hơn.",
  "ai-timeout": "Quá thời gian kết nối AI. Vui lòng thử lại sau.",
};

type ScanOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

type DecodeResult = { text: string; bounds?: CropRect };
type ImageVariant = "original" | "grayscale" | "contrast" | "threshold-80" | "threshold-110" | "threshold-140" | "threshold-170" | "inverted";

const zxingReader = new BrowserQRCodeReader();
const FIXED_THRESHOLDS = [80, 110, 140, 170] as const;

const normalizeText = (value: string) =>
  value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");

const clampRect = (rect: CropRect, imageWidth: number, imageHeight: number): CropRect => {
  const width = Math.max(1, Math.min(Math.round(rect.width), imageWidth));
  const height = Math.max(1, Math.min(Math.round(rect.height), imageHeight));
  const x = Math.max(0, Math.min(Math.round(rect.x), imageWidth - width));
  const y = Math.max(0, Math.min(Math.round(rect.y), imageHeight - height));
  return { x, y, width, height };
};

const normalizeGenderLabel = (value: string) => {
  const normalized = normalizeText(value).replace(/[.,:;_-]/g, " ").replace(/\s+/g, " ").trim();
  if (["nam", "male", "m"].includes(normalized)) return "Nam";
  if (["nu", "female", "f"].includes(normalized)) return "Nữ";
  return value.trim();
};

export const normalizeVietnameseDate = (value: string) => {
  const text = value.trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})[T\s].*$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const slashMatch = text.match(/^(\d{2})[/.:-](\d{2})[/.:-](\d{4})$/);
  if (slashMatch) return `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`;

  const spelledMatch = normalizeText(text).match(/(?:ngay\s*)?(\d{1,2})\s*(?:thg|thang|month|m)?\s*(\d{1,2})\s*[,./-]?\s*(\d{4})/);
  if (spelledMatch) return `${spelledMatch[3]}-${spelledMatch[2].padStart(2, "0")}-${spelledMatch[1].padStart(2, "0")}`;

  const compact = text.replace(/[^\d]/g, "");
  if (/^\d{8}$/.test(compact)) return `${compact.slice(4, 8)}-${compact.slice(2, 4)}-${compact.slice(0, 2)}`;
  return text;
};

export const formatBirthDateForDisplay = (value: string) => {
  const normalized = normalizeVietnameseDate(value);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value.trim();
};

export const parseCccdQrPayload = (rawText: string): Partial<CccdQrDraft> | null => {
  const normalized = rawText.trim();
  if (!normalized) return null;

  const pipeParts = normalized.split("|").map((part) => part.trim());
  if (pipeParts.length >= 6) {
    const [citizenId = "", oldId = "", fullName = "", dob = "", gender = "", address = ""] = pipeParts;
    const result = {
      fullName,
      phone: "",
      citizenId: citizenId || oldId,
      address,
      gender: normalizeGenderLabel(gender),
      birthDate: normalizeVietnameseDate(dob),
      nationality: "Việt Nam",
    };
    return isLikelyCccdQrDraft(result) ? result : null;
  }

  if (normalized.startsWith("{") && normalized.endsWith("}")) {
    try {
      const json = JSON.parse(normalized) as Record<string, unknown>;
      const result: Partial<CccdQrDraft> = {
        fullName: String(json.fullName || json.name || json.hoTen || "").trim(),
        phone: String(json.phone || json.phoneNumber || "").trim(),
        citizenId: String(json.citizenId || json.cccd || json.idNumber || json.identityCard || json.identityNo || "").trim(),
        address: String(json.address || json.permanentAddress || json.diaChi || "").trim(),
        nationality: String(json.nationality || json.quocTich || "Việt Nam").trim() || "Việt Nam",
        gender: normalizeGenderLabel(String(json.gender || json.gioiTinh || "")),
        birthDate: normalizeVietnameseDate(String(json.birthDate || json.dob || json.ngaySinh || "")),
      };
      return isLikelyCccdQrDraft(result) ? result : null;
    } catch {
      // fall through to line-based parsing
    }
  }

  const lines = normalized.split(/[\r\n;]+/).map((line) => line.trim()).filter(Boolean);
  const entries = lines.map((line) => {
    const parts = line.split(/[:=]/);
    return parts.length > 1
      ? { key: normalizeText(parts[0]), value: parts.slice(1).join(":").trim() }
      : { key: "", value: line };
  });
  const findValue = (patterns: RegExp[]) => entries.find((item) => patterns.some((pattern) => pattern.test(item.key)))?.value || "";
  const result: Partial<CccdQrDraft> = {
    fullName: findValue([/ho ten/, /^name$/, /full\s*name/]),
    phone: findValue([/sdt/, /dien thoai/, /^phone$/]),
    citizenId: findValue([/cccd/, /cmnd/, /id\s*no/, /^id$/]) || normalized.match(/\b\d{12}\b/)?.[0] || "",
    address: findValue([/dia chi/, /thuong tru/, /address/]),
    nationality: findValue([/quoc tich/, /nationality/]) || "Việt Nam",
    gender: normalizeGenderLabel(findValue([/gioi tinh/, /gender/])),
    birthDate: normalizeVietnameseDate(findValue([/ngay sinh/, /dob/, /birth/])),
  };
  return isLikelyCccdQrDraft(result) ? result : null;
};

const isLikelyCccdQrDraft = (draft: Partial<CccdQrDraft>) =>
  /^\d{12}$/.test(draft.citizenId || "") && Boolean((draft.fullName || "").trim() || normalizeVietnameseDate(draft.birthDate || ""));

export const isLikelyCccdQrPayload = (rawText: string) => {
  const text = rawText.trim();
  if (!text || /^https?:\/\//i.test(text)) return false;
  return Boolean(parseCccdQrPayload(text));
};

export const buildQrCropCandidates = (imageWidth: number, imageHeight: number): CropRect[] => {
  const candidates: CropRect[] = [{ x: 0, y: 0, width: imageWidth, height: imageHeight }];
  const scales = [0.1, 0.15, 0.2, 0.25, 0.33, 0.4, 0.5, 0.65, 0.8];

  for (const scale of scales) {
    const width = Math.max(1, Math.round(imageWidth * scale));
    const height = Math.max(1, Math.round(imageHeight * scale));
    const maxX = imageWidth - width;
    const maxY = imageHeight - height;

    // Corners first: this catches the common CCCD layout quickly without assuming one fixed corner.
    candidates.push(
      { x: 0, y: 0, width, height },
      { x: maxX, y: 0, width, height },
      { x: 0, y: maxY, width, height },
      { x: maxX, y: maxY, width, height },
    );

    const stepX = Math.max(1, Math.round(width * 0.5));
    const stepY = Math.max(1, Math.round(height * 0.5));
    for (let y = 0; y <= maxY; y += stepY) {
      for (let x = 0; x <= maxX; x += stepX) candidates.push({ x, y, width, height });
      candidates.push({ x: maxX, y, width, height });
    }
    for (let x = 0; x <= maxX; x += stepX) candidates.push({ x, y: maxY, width, height });
  }

  const seen = new Set<string>();
  return candidates.map((rect) => clampRect(rect, imageWidth, imageHeight)).filter((rect) => {
    const key = `${rect.x}:${rect.y}:${rect.width}:${rect.height}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const fitIntoCanvas = (imageWidth: number, imageHeight: number, maxDimension = 2000, minDimension = 800) => {
  const longestSide = Math.max(imageWidth, imageHeight);
  const shortestSide = Math.min(imageWidth, imageHeight);
  const upscale = shortestSide < minDimension ? minDimension / shortestSide : 1;
  const downscale = longestSide * upscale > maxDimension ? maxDimension / (longestSide * upscale) : 1;
  const scale = upscale * downscale;
  return { width: Math.max(1, Math.round(imageWidth * scale)), height: Math.max(1, Math.round(imageHeight * scale)), scale };
};

const renderCropToCanvas = (image: HTMLImageElement, crop: CropRect, canvas: HTMLCanvasElement, rotationDegrees = 0) => {
  const fit = fitIntoCanvas(crop.width, crop.height);
  const quarterTurn = rotationDegrees === 90 || rotationDegrees === 270;
  canvas.width = quarterTurn ? fit.height : fit.width;
  canvas.height = quarterTurn ? fit.width : fit.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((rotationDegrees * Math.PI) / 180);
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, -fit.width / 2, -fit.height / 2, fit.width, fit.height);
  context.restore();
  return context;
};

const applyVariant = (context: CanvasRenderingContext2D, width: number, height: number, variant: ImageVariant) => {
  if (variant === "original") return;
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  const threshold = variant.startsWith("threshold-") ? Number(variant.slice(10)) : 0;
  for (let index = 0; index < data.length; index += 4) {
    const luminance = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
    let value = luminance;
    if (variant === "contrast") value = Math.max(0, Math.min(255, (luminance - 128) * 1.45 + 128));
    if (variant.startsWith("threshold-")) value = luminance >= threshold ? 255 : 0;
    if (variant === "inverted") value = 255 - luminance;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
    data[index + 3] = 255;
  }
  context.putImageData(imageData, 0, 0);
};

const canvasBoundsToImageBounds = (bounds: CropRect | undefined, crop: CropRect, canvas: HTMLCanvasElement): CropRect => {
  if (!bounds) return crop;
  return {
    x: Math.round(crop.x + (bounds.x / canvas.width) * crop.width),
    y: Math.round(crop.y + (bounds.y / canvas.height) * crop.height),
    width: Math.max(1, Math.round((bounds.width / canvas.width) * crop.width)),
    height: Math.max(1, Math.round((bounds.height / canvas.height) * crop.height)),
  };
};

async function decodeCanvasQr(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, useDetector: boolean): Promise<DecodeResult | null> {
  if (useDetector && typeof window !== "undefined" && "BarcodeDetector" in window) {
    try {
      const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
      const barcode = (await detector.detect(canvas))?.[0];
      const text = barcode?.rawValue?.trim?.() || "";
      if (text && isLikelyCccdQrPayload(text)) return { text, bounds: barcode.boundingBox };
    } catch { /* fall through */ }
  }

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const decoded = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" });
  if (decoded?.data?.trim?.() && isLikelyCccdQrPayload(decoded.data)) {
    const points = Object.values(decoded.location);
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return { text: decoded.data.trim(), bounds: { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) } };
  }

  try {
    const result = zxingReader.decodeFromCanvas(canvas);
    const text = result?.getText?.()?.trim?.() || "";
    if (text && isLikelyCccdQrPayload(text)) return { text };
  } catch { /* keep searching */ }
  return null;
}

const yieldToMainThread = () => new Promise<void>((resolve) => window.setTimeout(resolve, 0));

const analyzeImageQuality = (image: HTMLImageElement): QrFailureReason => {
  const shortestSide = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
  if (shortestSide < 720) return "insufficient-resolution";

  const canvas = document.createElement("canvas");
  const fit = fitIntoCanvas(image.naturalWidth || image.width, image.naturalHeight || image.height, 512, 1);
  canvas.width = fit.width;
  canvas.height = fit.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return "qr-not-found";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let brightness = 0;
  let glarePixels = 0;
  let edgeEnergy = 0;
  let previous = 0;
  const pixelCount = data.length / 4;
  for (let index = 0; index < data.length; index += 4) {
    const luminance = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
    brightness += luminance;
    if (luminance > 245) glarePixels += 1;
    if (index > 0) edgeEnergy += Math.abs(luminance - previous);
    previous = luminance;
  }
  const averageBrightness = brightness / pixelCount;
  if (averageBrightness < 55) return "too-dark";
  if (glarePixels / pixelCount > 0.16) return "glare-detected";
  if (edgeEnergy / pixelCount < 9) return "image-blurry";
  return "qr-not-found";
};

export async function scanImageForCccdQr(
  file: File,
  onProgress?: (payload: CccdQrScanProgress) => void,
  options: ScanOptions = {},
) {
  const imageUrl = URL.createObjectURL(file);
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? 9000;
  const assertActive = () => {
    if (options.signal?.aborted) throw new DOMException("QR scan cancelled", "AbortError");
    if (Date.now() - startedAt > timeoutMs) throw new DOMException("QR scan timed out", "TimeoutError");
  };

  try {
    onProgress?.({ step: 0, total: 1, phase: "loading" });
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Không thể tải ảnh CCCD."));
      element.src = imageUrl;
    });
    assertActive();

    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    const candidates = buildQrCropCandidates(imageWidth, imageHeight);
    const canvas = document.createElement("canvas");
    const useDetector = typeof window !== "undefined" && "BarcodeDetector" in window;
    const variants: ImageVariant[] = ["original", "grayscale", "contrast", ...FIXED_THRESHOLDS.map((value) => `threshold-${value}` as ImageVariant), "inverted"];
    const rotations = [0, 90, 180, 270];
    const total = candidates.length * variants.length + candidates.length * (rotations.length - 1);
    let step = 0;

    const attempt = async (crop: CropRect, variant: ImageVariant, rotation: number, phase: CccdQrScanProgress["phase"]) => {
      assertActive();
      step += 1;
      onProgress?.({ step, total, phase, scanningCrop: crop });
      const context = renderCropToCanvas(image, crop, canvas, rotation);
      if (!context) return null;
      applyVariant(context, canvas.width, canvas.height, variant);
      const decoded = await decodeCanvasQr(canvas, context, useDetector);
      if (!decoded) return null;
      const detectedQrBounds = rotation === 0 ? canvasBoundsToImageBounds(decoded.bounds, crop, canvas) : crop;
      onProgress?.({ step, total, phase: "decoded", detectedQrBounds });
      return { decodedText: decoded.text, crop: detectedQrBounds, imageWidth, imageHeight };
    };

    for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
      const variant = variants[variantIndex];
      for (let index = 0; index < candidates.length; index += 1) {
        const result = await attempt(candidates[index], variant, 0, index === 0 && variant === "original" ? "full-image" : variant === "original" ? "searching" : "enhancing");
        if (result) return result;
        if ((index + 1) % 4 === 0) await yieldToMainThread();
      }
    }

    for (const rotation of rotations.slice(1)) {
      for (let index = 0; index < candidates.length; index += 1) {
        const result = await attempt(candidates[index], "original", rotation, "rotating");
        if (result) return result;
        if ((index + 1) % 4 === 0) await yieldToMainThread();
      }
    }

    // Fallback to AI
    onProgress?.({ step, total, phase: "analyzing-ai" });
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch("/api/extract-cccd", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(id);
      
      if (response.ok) {
        const json = await response.json();
        if (json && Object.keys(json).length > 0 && (json.fullName || json.citizenId)) {
          // Serialize to JSON string matching parseCccdQrPayload requirements for JSON
          const decodedText = JSON.stringify(json);
          onProgress?.({ step, total, phase: "decoded", detectedQrBounds: undefined });
          return { decodedText, crop: undefined, imageWidth, imageHeight };
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        onProgress?.({ step, total, phase: "failed", failureReason: "ai-timeout" });
        return null;
      }
      console.error("AI Fallback error:", err);
    }

    onProgress?.({ step, total, phase: "failed", failureReason: analyzeImageQuality(image) });
    return null;
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      onProgress?.({ step: 1, total: 1, phase: "failed", failureReason: "timeout" });
      return null;
    }
    throw error;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}
