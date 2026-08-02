"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Sparkles, Check, RefreshCw, QrCode } from "lucide-react";
import { useToast } from "@/components/ui/ToastContext";

interface Point {
  x: number;
  y: number;
}

interface CccdUploadScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  onSuccess: (decodedText: string) => void;
}

export const CccdUploadScannerModal: React.FC<CccdUploadScannerModalProps> = ({
  isOpen,
  onClose,
  file,
  onSuccess,
}) => {
  const [imgUrl, setImgUrl] = useState<string>("");
  const [warpedImgUrl, setWarpedImgUrl] = useState<string>("");

  const [step, setStep] = useState<"crop" | "scan" | "success">("crop");

  const [corners, setCorners] = useState<Point[]>([
    { x: 0.15, y: 0.15 },
    { x: 0.85, y: 0.15 },
    { x: 0.85, y: 0.85 },
    { x: 0.15, y: 0.85 },
  ]);
  const [sourceSize, setSourceSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const [activeCornerIdx, setActiveCornerIdx] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);

  const { showToast } = useToast();

  // Load Iframe worker
  useEffect(() => {
    if (!isOpen) {
      setIsIframeLoaded(false);
    }
  }, [isOpen]);

  // Init File and Auto Corner Detection
  useEffect(() => {
    if (!file || !isOpen) return;
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    setStep("crop");
    setWarpedImgUrl("");
    setStatusMessage("Đang tải ảnh...");

    // Reset default corners
    setCorners([
      { x: 0.15, y: 0.15 },
      { x: 0.85, y: 0.15 },
      { x: 0.85, y: 0.85 },
      { x: 0.15, y: 0.85 },
    ]);

    const runDetection = async () => {
      // Wait for iframe to load and CCCDLocalScan to be exposed
      let attempts = 0;
      while (attempts < 60) {
        const iframeWin = iframeRef.current?.contentWindow as any;
        if (iframeWin && iframeWin.CCCDLocalScan) {
          break;
        }
        await new Promise((r) => setTimeout(r, 150));
        attempts++;
      }

      const iframeWin = iframeRef.current?.contentWindow as any;
      const localScan = iframeWin?.CCCDLocalScan;
      if (!localScan) {
        setStatusMessage("Không thể kết nối trình quét. Vui lòng kéo 4 góc xanh lá thủ công.");
        return;
      }

      try {
        setIsProcessing(true);
        setStatusMessage("Đang nhận diện biên thẻ tự động...");
        const detectResult = await localScan.scanFile(file, { autoProcess: false });
        
        if (detectResult && detectResult.card && detectResult.card.sourceSize) {
          const width = detectResult.card.sourceSize.width;
          const height = detectResult.card.sourceSize.height;
          setSourceSize({ width, height });

          if (detectResult.status === "CARD_DETECTED" && detectResult.card.cornersOriginal?.length === 4) {
            const scaledCorners = detectResult.card.cornersOriginal.map((c: any) => ({
              x: c.x / width,
              y: c.y / height,
            }));
            setCorners(scaledCorners);
            setStatusMessage("Đã đề xuất vùng thẻ. Bạn có thể kéo thả 4 góc để căn chỉnh.");
          } else {
            setStatusMessage("Không tìm thấy khung chuẩn, vui lòng kéo tay 4 góc xanh lá.");
          }
        } else {
          setStatusMessage("Không tìm thấy khung chuẩn, vui lòng kéo tay 4 góc xanh lá.");
        }
      } catch (error) {
        console.error("Auto corner detection error:", error);
        setStatusMessage("Lỗi tự động nhận diện góc. Hãy kéo tay 4 góc.");
      } finally {
        setIsProcessing(false);
      }
    };

    runDetection();

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, isOpen, isIframeLoaded]);

  const handleStartDrag = (idx: number) => {
    setActiveCornerIdx(idx);
  };

  const handleMouseMove = (e: any) => {
    if (activeCornerIdx === null || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const isTouch = e.touches && e.touches.length > 0;
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;

    let relativeX = (clientX - rect.left) / rect.width;
    let relativeY = (clientY - rect.top) / rect.height;

    relativeX = Math.max(0, Math.min(1, relativeX));
    relativeY = Math.max(0, Math.min(1, relativeY));

    setCorners((prev) => {
      const next = [...prev];
      next[activeCornerIdx] = { x: relativeX, y: relativeY };
      return next;
    });
  };

  const handleMouseUp = () => {
    setActiveCornerIdx(null);
  };

  useEffect(() => {
    if (activeCornerIdx !== null) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);

      const handleTouchMove = (e: TouchEvent) => handleMouseMove(e);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleMouseUp);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("touchend", handleMouseUp);
      };
    }
  }, [activeCornerIdx]);

  const runAutoDetect = async () => {
    const iframeWin = iframeRef.current?.contentWindow as any;
    const localScan = iframeWin?.CCCDLocalScan;
    if (!localScan || !file) return;

    try {
      setIsProcessing(true);
      setStatusMessage("Đang nhận diện biên thẻ tự động...");
      const detectResult = await localScan.scanFile(file, { autoProcess: false });
      
      if (detectResult && detectResult.card && detectResult.card.sourceSize) {
        const width = detectResult.card.sourceSize.width;
        const height = detectResult.card.sourceSize.height;
        setSourceSize({ width, height });

        if (detectResult.status === "CARD_DETECTED" && detectResult.card.cornersOriginal?.length === 4) {
          const scaledCorners = detectResult.card.cornersOriginal.map((c: any) => ({
            x: c.x / width,
            y: c.y / height,
          }));
          setCorners(scaledCorners);
          setStatusMessage("Đã tự động căn góc.");
          showToast("Đã tự động nhận diện góc thẻ.", "success");
        } else {
          showToast("Không tìm thấy khung thẻ chuẩn.", "error");
        }
      }
    } catch (error) {
      console.error(error);
      showToast("Lỗi nhận dạng tự động.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCropAndScan = async () => {
    const iframeWin = iframeRef.current?.contentWindow as any;
    const localScan = iframeWin?.CCCDLocalScan;
    if (!localScan || !file || sourceSize.width === 0) return;

    setIsProcessing(true);
    setStatusMessage("Đang phẳng hóa và giải mã QR...");
    setStep("scan");

    try {
      // Map 0..1 scale back to absolute pixel coordinates for the original image space
      const absoluteCorners = corners.map((p) => ({
        x: p.x * sourceSize.width,
        y: p.y * sourceSize.height,
      }));

      // Update the corners in the worker iframe
      await localScan.setCorners(absoluteCorners, { coordinateSpace: "original" });

      // Run perspective warp and QR binarized decoding inside the worker
      const scanResult = await localScan.confirmAndProcess();
      
      if (scanResult && scanResult.qr && scanResult.qr.payload) {
        // Success
        setWarpedImgUrl(scanResult.processedImage?.jpegDataUrl || scanResult.processedImage?.pngDataUrl || "");
        setStatusMessage("Đã trích xuất thông tin thành công!");
        setStep("success");

        setTimeout(() => {
          const rawText = typeof scanResult.qr.payload === "string"
            ? scanResult.qr.payload
            : (scanResult.qr.payload?.raw || "");
          onSuccess(rawText);
        }, 1200);
      } else {
        // Failed
        showToast("Không tìm thấy QR trên hình ảnh.", "error");
        setStatusMessage("Không tìm thấy QR phù hợp.");
        setStep("crop");
      }
    } catch (error: any) {
      console.error(error);
      showToast("Không thể giải mã QR. Hãy chọn ảnh rõ hơn hoặc căn chỉnh sát biên.", "error");
      setStatusMessage("Có lỗi xảy ra khi giải mã.");
      setStep("crop");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/90 p-4 text-white backdrop-blur-sm select-none">
      {/* Headless Iframe Worker */}
      <iframe
        ref={iframeRef}
        src="/qr/index.html?embed=true"
        style={{ display: "none" }}
        onLoad={() => setIsIframeLoaded(true)}
      />

      <div className="flex w-full max-w-[600px] items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-3">
          <QrCode className="text-indigo-400" size={22} />
          <div>
            <h3 className="text-lg font-black tracking-wide text-emerald-100 uppercase flex items-center gap-2">
              Quét QR CCCD
              {step === "crop" && (
                <span className="text-[9px] normal-case bg-indigo-500/10 border border-indigo-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Sparkles size={8} /> Auto Detect
                </span>
              )}
            </h3>
            <p className="text-[11px] text-white/50">
              {step === "crop" ? "Căn chỉnh 4 góc thẻ CCCD để quét QR chính xác" : statusMessage}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-full bg-white/5 p-2 hover:bg-white/10"
          disabled={isProcessing}
        >
          <X size={18} />
        </button>
      </div>

      <div className="relative flex-1 w-full max-w-[600px] flex items-center justify-center py-6 overflow-hidden">
        {step === "crop" && (
          <div ref={containerRef} className="relative inline-block max-h-[60vh] max-w-full">
            {imgUrl && (
              <img
                ref={imageRef}
                src={imgUrl}
                alt="Original CCCD"
                className="max-h-[60vh] max-w-full w-auto h-auto block border border-white/10 rounded"
              />
            )}

            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <polygon
                points={`
                  ${corners[0].x * 100},${corners[0].y * 100}
                  ${corners[1].x * 100},${corners[1].y * 100}
                  ${corners[2].x * 100},${corners[2].y * 100}
                  ${corners[3].x * 100},${corners[3].y * 100}
                `}
                style={{
                  fill: "rgba(52, 211, 153, 0.15)",
                  stroke: "#8b5cf6",
                  strokeWidth: 0.6,
                  strokeDasharray: "1 0.5",
                }}
              />
            </svg>

            {corners.map((p, idx) => (
              <div
                key={idx}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-move flex items-center justify-center"
                style={{
                  left: `${p.x * 100}%`,
                  top: `${p.y * 100}%`,
                  width: 32,
                  height: 32,
                }}
                onMouseDown={() => handleStartDrag(idx)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  handleStartDrag(idx);
                }}
              >
                <div className="h-5 w-5 rounded-full border-2 border-indigo-400 bg-indigo-500/80 shadow-[0_0_8px_rgba(16,185,129,0.8)] active:scale-125 transition-transform duration-75" />
                <div className="absolute h-1.5 w-1.5 rounded-full bg-white" />
              </div>
            ))}
          </div>
        )}

        {(step === "scan" || step === "success") && (
          <div className="relative inline-block max-h-[60vh] max-w-full">
            {warpedImgUrl ? (
              <img
                src={warpedImgUrl}
                alt="Cropped CCCD"
                className="max-h-[60vh] max-w-full w-auto h-auto block border border-white/10 rounded"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3">
                <RefreshCw className="animate-spin text-indigo-400" size={32} />
                <p className="text-sm text-white/70">{statusMessage}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="w-full max-w-[600px] flex items-center justify-between border-t border-white/10 pt-4">
        {step === "crop" ? (
          <>
            <button
              onClick={runAutoDetect}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-emerald-300 hover:bg-indigo-500/20 disabled:opacity-50"
            >
              <Sparkles size={15} /> Tự động căn góc
            </button>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white/80">Hủy</button>
              <button
                onClick={handleCropAndScan}
                disabled={isProcessing}
                className="flex items-center gap-2 px-5 py-2 text-sm font-black rounded-lg bg-indigo-500 hover:bg-indigo-400 text-black shadow-lg shadow-indigo-500/20 disabled:opacity-50"
              >
                {isProcessing ? <><RefreshCw className="animate-spin" size={15} /> Xử lý...</> : <><Check size={15} /> Cắt & Quét QR</>}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1"></div>
            <div className="flex gap-3">
              {step === "scan" && !isProcessing && (
                <button onClick={() => setStep("crop")} className="px-4 py-2 text-sm font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white/80">Thử lại</button>
              )}
              {step === "success" && (
                <div className="flex items-center gap-2 px-5 py-2 text-sm font-black rounded-lg bg-indigo-500 text-black">
                  <Check size={15} /> Hoàn tất
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
