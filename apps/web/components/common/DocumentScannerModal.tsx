import React, { useState, useRef, useEffect } from "react";
import { X, RotateCw, Sparkles, Check, RefreshCw, Sun, Contrast } from "lucide-react";
import { Point, warpImageFile, autoDetectDocumentCorners, detectDocumentCornersOpenCV } from "../../lib/utils/perspective-warp";

interface DocumentScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  onSave: (warpedFile: File) => void;
}

export const DocumentScannerModal: React.FC<DocumentScannerModalProps> = ({
  isOpen,
  onClose,
  file,
  onSave,
}) => {
  const [imgUrl, setImgUrl] = useState<string>("");
  const [rotatedFile, setRotatedFile] = useState<File | null>(null);
  
  // Coordinates as relative values (0 to 1)
  const [corners, setCorners] = useState<Point[]>([
    { x: 0.15, y: 0.15 }, // TL
    { x: 0.85, y: 0.15 }, // TR
    { x: 0.85, y: 0.85 }, // BR
    { x: 0.15, y: 0.85 }, // BL
  ]);

  const [activeCornerIdx, setActiveCornerIdx] = useState<number | null>(null);
  const [isWarping, setIsWarping] = useState(false);
  const [brightness, setBrightness] = useState<number>(0);
  const [contrast, setContrast] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [isOpenCvLoaded, setIsOpenCvLoaded] = useState(false);
  const [isOpenCvLoading, setIsOpenCvLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const checkAndLoadOpenCV = () => {
      const globalCv = (window as any).cv;
      if (globalCv && globalCv.Mat) {
        setIsOpenCvLoaded(true);
        return;
      }

      if (document.getElementById("opencv-script")) {
        setIsOpenCvLoading(true);
        const interval = setInterval(() => {
          const checkCv = (window as any).cv;
          if (checkCv && checkCv.Mat) {
            setIsOpenCvLoaded(true);
            setIsOpenCvLoading(false);
            clearInterval(interval);
          }
        }, 150);
        return;
      }

      setIsOpenCvLoading(true);

      let loaded = false;
      let timeoutId: any = null;

      const injectScript = (srcUrl: string, onFail: () => void) => {
        const script = document.createElement("script");
        script.id = "opencv-script";
        script.src = srcUrl;
        script.async = true;

        script.onload = () => {
          if (loaded) return;
          const interval = setInterval(() => {
            const checkCv = (window as any).cv;
            if (checkCv && checkCv.Mat) {
              loaded = true;
              if (timeoutId) clearTimeout(timeoutId);
              setIsOpenCvLoaded(true);
              setIsOpenCvLoading(false);
              clearInterval(interval);
            }
          }, 150);
        };

        script.onerror = () => {
          if (loaded) return;
          script.remove();
          if (timeoutId) clearTimeout(timeoutId);
          onFail();
        };

        document.body.appendChild(script);

        // Generous 40-second timeout to allow download & WebAssembly compilation
        timeoutId = setTimeout(() => {
          if (!loaded) {
            console.warn(`OpenCV.js loading timed out for source: ${srcUrl}. Trying fallback...`);
            script.remove();
            onFail();
          }
        }, 40000);
      };

      const loadLocal = () => {
        injectScript("/opencv.js", loadJsDelivr);
      };

      const loadJsDelivr = () => {
        injectScript(
          "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@5.0.0-release.1/dist/opencv.min.js",
          loadUnpkg
        );
      };

      const loadUnpkg = () => {
        injectScript(
          "https://unpkg.com/@techstark/opencv-js@5.0.0-release.1/dist/opencv.min.js",
          () => {
            console.error("All OpenCV script sources failed to load.");
            setIsOpenCvLoading(false);
          }
        );
      };

      loadLocal();
    };

    checkAndLoadOpenCV();
  }, [isOpen]);

  // Initialize and clean up URL
  useEffect(() => {
    if (!file) return;
    setRotatedFile(file);
    setBrightness(0);
    setContrast(0);
    // Reset corners to standard shape
    setCorners([
      { x: 0.15, y: 0.15 },
      { x: 0.85, y: 0.15 },
      { x: 0.85, y: 0.85 },
      { x: 0.15, y: 0.85 },
    ]);
  }, [file, isOpen]);

  useEffect(() => {
    if (!rotatedFile) return;
    const url = URL.createObjectURL(rotatedFile);
    setImgUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [rotatedFile]);

  // Handle Corner Dragging
  const handleStartDrag = (idx: number) => {
    setActiveCornerIdx(idx);
  };

  const handleMouseMove = (e: any) => {
    if (activeCornerIdx === null || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    
    // Calculate client mouse/touch coordinates safely
    const isTouch = e.touches && e.touches.length > 0;
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;

    let relativeX = (clientX - rect.left) / rect.width;
    let relativeY = (clientY - rect.top) / rect.height;

    // Clamp relative coordinates to 0..1
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

  // Attach global listeners while dragging to make experience smooth
  useEffect(() => {
    if (activeCornerIdx !== null) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      
      // Also support touch devices
      const handleTouchMove = (e: TouchEvent) => {
        handleMouseMove(e);
      };
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

  if (!isOpen || !file) return null;

  // Automatically detect document corners on demand
  const runAutoDetect = () => {
    if (!imageRef.current) return;
    
    const img = imageRef.current;

    // 1. Try OpenCV first if loaded
    const globalCv = (window as any).cv;
    if (globalCv && globalCv.Mat) {
      try {
        const detected = detectDocumentCornersOpenCV(img);
        if (detected) {
          setCorners(detected);
          return;
        }
      } catch (err) {
        console.error("OpenCV detection failed, falling back to Sobel:", err);
      }
    }

    // 2. Fallback to custom Sobel/Binarization detector
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.drawImage(img, 0, 0);
    try {
      const detected = autoDetectDocumentCorners(canvas);
      setCorners(detected);
    } catch (err) {
      console.error("Fallback corner detection failed:", err);
    }
  };

  // Rotate Image 90 degrees clockwise
  const handleRotate = () => {
    if (!rotatedFile) return;

    const img = new Image();
    img.src = imgUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Rotate around center
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

      canvas.toBlob((blob) => {
        if (blob) {
          const newFile = new File([blob], rotatedFile.name, { type: "image/jpeg" });
          setRotatedFile(newFile);
        }
      }, "image/jpeg", 0.95);
    };
  };

  // Warp Perspective and return to parent
  const handleWarp = async () => {
    if (!rotatedFile || !imageRef.current) return;
    setIsWarping(true);

    try {
      const imgWidth = imageRef.current.naturalWidth;
      const imgHeight = imageRef.current.naturalHeight;

      // Scale corners from relative 0..1 to natural pixel size
      const srcPoints = corners.map((p) => ({
        x: p.x * imgWidth,
        y: p.y * imgHeight,
      }));

      // Calculate natural crop size based on quadrilateral dimensions
      const p0 = srcPoints[0];
      const p1 = srcPoints[1];
      const p2 = srcPoints[2];
      const p3 = srcPoints[3];

      const w1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const w2 = Math.hypot(p2.x - p3.x, p2.y - p3.y);
      const h1 = Math.hypot(p3.x - p0.x, p3.y - p0.y);
      const h2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);

      let destWidth = Math.round(Math.max(w1, w2));
      let destHeight = Math.round(Math.max(h1, h2));

      // Optimize sizing to prevent freeze
      const maxDim = 1600;
      if (destWidth > maxDim || destHeight > maxDim) {
        const ratio = Math.min(maxDim / destWidth, maxDim / destHeight);
        destWidth = Math.round(destWidth * ratio);
        destHeight = Math.round(destHeight * ratio);
      }

      // Perform warp
      const warpedFile = await warpImageFile(
        rotatedFile,
        srcPoints,
        destWidth,
        destHeight,
        brightness,
        contrast
      );

      onSave(warpedFile);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Không thể phẳng hóa ảnh. Vui lòng kiểm tra lại 4 góc.");
    } finally {
      setIsWarping(false);
    }
  };

  // CamScanner Enhancements Presets
  const applyPreset = (preset: "original" | "magic" | "bw") => {
    if (preset === "original") {
      setBrightness(0);
      setContrast(0);
    } else if (preset === "magic") {
      setBrightness(15);
      setContrast(25);
    } else if (preset === "bw") {
      setBrightness(5);
      setContrast(50);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/90 p-4 text-white backdrop-blur-sm select-none">
      {/* Top Header */}
      <div className="flex w-full max-w-4xl items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-3">
          <Sparkles className="text-indigo-400 animate-pulse" size={22} />
          <div>
            <h3 className="text-lg font-black tracking-wide text-emerald-100 uppercase flex items-center gap-2">
              Cân chỉnh tài liệu & Phẳng hóa
              {isOpenCvLoaded && (
                <span className="text-[9px] normal-case bg-indigo-500/10 border border-indigo-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Sparkles size={8} />
                  CamScanner AI Active
                </span>
              )}
            </h3>
            <p className="text-[11px] text-white/50">
              Kéo thả 4 góc tròn để xác định biên của tài liệu (như CamScanner)
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-full bg-white/5 p-2 hover:bg-white/10"
        >
          <X size={18} />
        </button>
      </div>

      {/* Main Image Container with Draggable Points */}
      <div className="relative flex-1 w-full max-w-4xl flex items-center justify-center py-6 overflow-hidden">
        <div 
          ref={containerRef}
          className="relative inline-block max-h-[60vh] max-w-full"
        >
          {imgUrl && (
            <img
              ref={imageRef}
              src={imgUrl}
              alt="Scan Target"
              className="max-h-[60vh] max-w-full w-auto h-auto block border border-white/10 rounded"
              onLoad={() => {
                runAutoDetect();
              }}
            />
          )}

          {/* SVG Overlay Lines */}
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

          {/* Draggable Circle Corners */}
          {corners.map((p, idx) => (
            <div
              key={idx}
              className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-move flex items-center justify-center`}
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
              {/* Outer Glow Circle */}
              <div className="h-5 w-5 rounded-full border-2 border-indigo-400 bg-indigo-500/80 shadow-[0_0_8px_rgba(16,185,129,0.8)] active:scale-125 transition-transform duration-75" />
              {/* Inner Coordinate Dot */}
              <div className="absolute h-1.5 w-1.5 rounded-full bg-white" />
            </div>
          ))}
        </div>
      </div>

      {/* Control Panels */}
      <div className="w-full max-w-4xl bg-zinc-900 border border-white/10 rounded-2xl p-4 flex flex-col gap-4">
        {/* Preset & Sliders Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-white/5 pb-4">
          {/* Preset Buttons */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold text-white/50 uppercase tracking-widest">
              Bộ lọc nâng cao (CamScanner)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => applyPreset("original")}
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white/90 border border-white/5"
              >
                Gốc
              </button>
              <button
                onClick={() => applyPreset("magic")}
                className="flex-1 px-3 py-2 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-xs font-semibold text-emerald-300 border border-indigo-500/20 flex items-center justify-center gap-1.5"
              >
                <Sparkles size={12} />
                Làm nét
              </button>
              <button
                onClick={() => applyPreset("bw")}
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 border border-white/5"
              >
                Đen trắng
              </button>
            </div>
          </div>

          {/* Contrast & Brightness sliders */}
          <div className="flex flex-col gap-2 justify-center">
            <div className="flex items-center gap-3">
              <Sun size={14} className="text-white/60" />
              <span className="text-xs text-white/70 w-16">Độ sáng:</span>
              <input
                type="range"
                min="-60"
                max="60"
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <span className="text-xs text-indigo-400 font-mono w-8 text-right">
                {brightness > 0 ? `+${brightness}` : brightness}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Contrast size={14} className="text-white/60" />
              <span className="text-xs text-white/70 w-16">Tương phản:</span>
              <input
                type="range"
                min="-60"
                max="60"
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <span className="text-xs text-indigo-400 font-mono w-8 text-right">
                {contrast > 0 ? `+${contrast}` : contrast}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={handleRotate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700"
            >
              <RotateCw size={15} />
              Xoay 90°
            </button>
            <button
              onClick={runAutoDetect}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-emerald-300 hover:bg-indigo-500/20"
            >
              <Sparkles size={15} />
              Tự động căn góc
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white/80"
            >
              Hủy
            </button>
            <button
              onClick={handleWarp}
              disabled={isWarping}
              className="flex items-center gap-2 px-5 py-2 text-sm font-black rounded-lg bg-indigo-500 hover:bg-indigo-400 text-black shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isWarping ? (
                <>
                  <RefreshCw className="animate-spin" size={15} />
                  Đang biến đổi...
                </>
              ) : (
                <>
                  <Check size={15} />
                  Áp dụng phẳng hóa
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
