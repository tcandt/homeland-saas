export type Point = { x: number; y: number };

// Solve Gaussian elimination system Ax = b
function solveGaussian(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
        maxRow = k;
      }
    }
    const temp = M[i];
    M[i] = M[maxRow];
    M[maxRow] = temp;

    if (Math.abs(M[i][i]) < 1e-8) {
      throw new Error("Ma trận suy biến, không thể giải homography");
    }

    for (let k = i + 1; k < n; k++) {
      const factor = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) {
        M[k][j] -= factor * M[i][j];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += M[i][j] * x[j];
    }
    x[i] = (M[i][n] - sum) / M[i][i];
  }
  return x;
}

// Compute Homography that maps destPoints to srcPoints
// destPoints are corners of output rectangle: (0,0), (W,0), (W,H), (0,H)
// srcPoints are coordinates in the source image
export function getHomographyMatrix(srcPoints: Point[], destPoints: Point[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x: u, y: v } = destPoints[i]; // input to transform (destination canvas coords)
    const { x, y } = srcPoints[i];       // output of transform (source image coords)

    // Row 2i
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);

    // Row 2i + 1
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }

  // Solves for h00, h01, h02, h10, h11, h12, h20, h21
  const h = solveGaussian(A, b);
  // Return all 9 elements of the 3x3 homography matrix (h22 = 1)
  return [...h, 1];
}

// Bilinear pixel lookup
function getBilinearFilteredPixel(
  imageData: ImageData,
  x: number,
  y: number
): [number, number, number, number] {
  const { width, height, data } = imageData;

  let x1 = Math.floor(x);
  let y1 = Math.floor(y);
  let x2 = x1 + 1;
  let y2 = y1 + 1;

  x1 = Math.max(0, Math.min(width - 1, x1));
  y1 = Math.max(0, Math.min(height - 1, y1));
  x2 = Math.max(0, Math.min(width - 1, x2));
  y2 = Math.max(0, Math.min(height - 1, y2));

  const dx = x - x1;
  const dy = y - y1;

  const idx11 = (y1 * width + x1) * 4;
  const idx12 = (y1 * width + x2) * 4;
  const idx21 = (y2 * width + x1) * 4;
  const idx22 = (y2 * width + x2) * 4;

  const r = (1 - dx) * (1 - dy) * data[idx11] +
    dx * (1 - dy) * data[idx12] +
    (1 - dx) * dy * data[idx21] +
    dx * dy * data[idx22];

  const g = (1 - dx) * (1 - dy) * data[idx11 + 1] +
    dx * (1 - dy) * data[idx12 + 1] +
    (1 - dx) * dy * data[idx21 + 1] +
    dx * dy * data[idx22 + 1];

  const b = (1 - dx) * (1 - dy) * data[idx11 + 2] +
    dx * (1 - dy) * data[idx12 + 2] +
    (1 - dx) * dy * data[idx21 + 2] +
    dx * dy * data[idx22 + 2];

  const a = (1 - dx) * (1 - dy) * data[idx11 + 3] +
    dx * (1 - dy) * data[idx12 + 3] +
    (1 - dx) * dy * data[idx21 + 3] +
    dx * dy * data[idx22 + 3];

  return [r, g, b, a];
}

// Warp perspective of a File/Blob to a flattened File
export function warpImageFile(
  file: File,
  srcPoints: Point[],
  destWidth: number,
  destHeight: number,
  brightness = 0, // -100 to 100
  contrast = 0    // -100 to 100
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;

    img.onload = () => {
      try {
        // Create source canvas
        const srcCanvas = document.createElement("canvas");
        srcCanvas.width = img.naturalWidth;
        srcCanvas.height = img.naturalHeight;
        const srcCtx = srcCanvas.getContext("2d");
        if (!srcCtx) throw new Error("Could not get source 2D context");
        srcCtx.drawImage(img, 0, 0);
        const srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);

        const safeWidth = Math.max(10, isNaN(destWidth) ? 100 : Math.round(destWidth));
        const safeHeight = Math.max(10, isNaN(destHeight) ? 100 : Math.round(destHeight));

        // Create destination canvas
        const destCanvas = document.createElement("canvas");
        destCanvas.width = safeWidth;
        destCanvas.height = safeHeight;
        const destCtx = destCanvas.getContext("2d");
        if (!destCtx) throw new Error("Could not get destination 2D context");
        const destData = destCtx.createImageData(safeWidth, safeHeight);

        // Destination corners
        const destPoints: Point[] = [
          { x: 0, y: 0 },
          { x: safeWidth, y: 0 },
          { x: safeWidth, y: safeHeight },
          { x: 0, y: safeHeight }
        ];

        // Solve homography
        const H = getHomographyMatrix(srcPoints, destPoints);
        const [h00, h01, h02, h10, h11, h12, h20, h21, h22] = H;

        // Warp pixel by pixel
        for (let v = 0; v < destHeight; v++) {
          for (let u = 0; u < destWidth; u++) {
            const w = h20 * u + h21 * v + h22;
            const x = (h00 * u + h01 * v + h02) / w;
            const y = (h10 * u + h11 * v + h12) / w;

            const destIdx = (v * destWidth + u) * 4;

            // Check if bounds are inside source image
            if (x >= 0 && x < srcCanvas.width && y >= 0 && y < srcCanvas.height) {
              const [r, g, b, a] = getBilinearFilteredPixel(srcData, x, y);

              // Apply Brightness and Contrast
              // Contrast adjustment factor: F = (259 * (C + 255)) / (255 * (259 - C))
              const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

              let newR = factor * (r - 128) + 128 + brightness;
              let newG = factor * (g - 128) + 128 + brightness;
              let newB = factor * (b - 128) + 128 + brightness;

              // Clamp to 0..255
              newR = Math.max(0, Math.min(255, newR));
              newG = Math.max(0, Math.min(255, newG));
              newB = Math.max(0, Math.min(255, newB));

              destData.data[destIdx] = newR;
              destData.data[destIdx + 1] = newG;
              destData.data[destIdx + 2] = newB;
              destData.data[destIdx + 3] = a;
            } else {
              // Out of bounds - transparent/black
              destData.data[destIdx] = 0;
              destData.data[destIdx + 1] = 0;
              destData.data[destIdx + 2] = 0;
              destData.data[destIdx + 3] = 0;
            }
          }
        }

        // Put warped pixels on destination canvas
        destCtx.putImageData(destData, 0, 0);

        // Convert canvas to File
        destCanvas.toBlob((blob) => {
          if (blob) {
            const name = file.name.substring(0, file.name.lastIndexOf(".")) + "_scanned.jpg";
            const warpedFile = new File([blob], name, { type: "image/jpeg" });
            resolve(warpedFile);
          } else {
            reject(new Error("Không thể chuyển đổi canvas thành ảnh"));
          }
        }, "image/jpeg", 0.9);

      } catch (err) {
        reject(err);
      }
    };

    reader.readAsDataURL(file);
  });
}

// Automatically detect document/CCCD corners using pure JS Boundary Line Fitting & Linear Intersection (CamScanner algorithm)
export function autoDetectDocumentCorners(canvas: HTMLCanvasElement): Point[] {
  const w = canvas.width;
  const h = canvas.height;

  // Standard fallback coordinates (15% margin)
  const fallback = [
    { x: 0.15, y: 0.15 },
    { x: 0.85, y: 0.15 },
    { x: 0.85, y: 0.85 },
    { x: 0.15, y: 0.85 },
  ];

  try {
    // 1. Downsample image to 150x150 for speed and noise reduction
    const scanW = 150;
    const scanH = Math.round((h / w) * scanW);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = scanW;
    tempCanvas.height = scanH;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return fallback;

    tempCtx.drawImage(canvas, 0, 0, scanW, scanH);
    const imgData = tempCtx.getImageData(0, 0, scanW, scanH);
    const data = imgData.data;

    // 2. Convert to grayscale
    const gray = new Float32Array(scanW * scanH);
    for (let i = 0; i < data.length; i += 4) {
      gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    const getPixel = (x: number, y: number): number => {
      const px = Math.max(0, Math.min(scanW - 1, x));
      const py = Math.max(0, Math.min(scanH - 1, y));
      return gray[py * scanW + px];
    };

    // 3. Compute Sobel Gradient Magnitude
    const gradient = new Float32Array(scanW * scanH);
    for (let y = 1; y < scanH - 1; y++) {
      for (let x = 1; x < scanW - 1; x++) {
        const gx =
          -1 * getPixel(x - 1, y - 1) + 1 * getPixel(x + 1, y - 1) +
          -2 * getPixel(x - 1, y) + 2 * getPixel(x + 1, y) +
          -1 * getPixel(x - 1, y + 1) + 1 * getPixel(x + 1, y + 1);

        const gy =
          -1 * getPixel(x - 1, y - 1) - 2 * getPixel(x, y - 1) - 1 * getPixel(x + 1, y - 1) +
          1 * getPixel(x - 1, y + 1) + 2 * getPixel(x, y + 1) + 1 * getPixel(x + 1, y + 1);

        gradient[y * scanW + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }

    // 4. Scan boundaries from outside-in to find gradient peaks (mép thẻ)
    const leftPoints: { x: number; y: number }[] = [];
    const rightPoints: { x: number; y: number }[] = [];
    const topPoints: { x: number; y: number }[] = [];
    const bottomPoints: { x: number; y: number }[] = [];

    const minGrad = 15;

    // Scan Left & Right borders along rows (skip top/bottom 15% to avoid corners)
    const yStart = Math.round(scanH * 0.15);
    const yEnd = Math.round(scanH * 0.85);
    for (let y = yStart; y < yEnd; y++) {
      // Left scan: from x = 4% to 45%
      let maxLGrad = 0;
      let maxLX = -1;
      const xLStart = Math.round(scanW * 0.04);
      const xLEnd = Math.round(scanW * 0.45);
      for (let x = xLStart; x < xLEnd; x++) {
        const g = gradient[y * scanW + x];
        if (g > maxLGrad) {
          maxLGrad = g;
          maxLX = x;
        }
      }
      if (maxLGrad > minGrad) {
        leftPoints.push({ x: maxLX, y });
      }

      // Right scan: from x = 96% down to 55%
      let maxRGrad = 0;
      let maxRX = -1;
      const xRStart = Math.round(scanW * 0.96);
      const xREnd = Math.round(scanW * 0.55);
      for (let x = xRStart; x > xREnd; x--) {
        const g = gradient[y * scanW + x];
        if (g > maxRGrad) {
          maxRGrad = g;
          maxRX = x;
        }
      }
      if (maxRGrad > minGrad) {
        rightPoints.push({ x: maxRX, y });
      }
    }

    // Scan Top & Bottom borders along columns (skip left/right 15%)
    const xStart = Math.round(scanW * 0.15);
    const xEnd = Math.round(scanW * 0.85);
    for (let x = xStart; x < xEnd; x++) {
      // Top scan: from y = 4% to 45%
      let maxTGrad = 0;
      let maxTY = -1;
      const yTStart = Math.round(scanH * 0.04);
      const yTEnd = Math.round(scanH * 0.45);
      for (let y = yTStart; y < yTEnd; y++) {
        const g = gradient[y * scanW + x];
        if (g > maxTGrad) {
          maxTGrad = g;
          maxTY = y;
        }
      }
      if (maxTGrad > minGrad) {
        topPoints.push({ x, y: maxTY });
      }

      // Bottom scan: from y = 96% down to 55%
      let maxBGrad = 0;
      let maxBY = -1;
      const yBStart = Math.round(scanH * 0.96);
      const yBEnd = Math.round(scanH * 0.55);
      for (let y = yBStart; y > yBEnd; y--) {
        const g = gradient[y * scanW + x];
        if (g > maxBGrad) {
          maxBGrad = g;
          maxBY = y;
        }
      }
      if (maxBGrad > minGrad) {
        bottomPoints.push({ x, y: maxBY });
      }
    }

    // 5. Line Fitting with Outlier Rejection (RANSAC-style)
    const fitRobustLine = (
      points: { x: number; y: number }[],
      fitYAsX = false
    ): { m: number; c: number } | null => {
      if (points.length < 5) return null;

      const fit = (pts: { x: number; y: number }[]) => {
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        const n = pts.length;
        for (const p of pts) {
          const u = fitYAsX ? p.y : p.x;
          const v = fitYAsX ? p.x : p.y;
          sumX += u;
          sumY += v;
          sumXY += u * v;
          sumXX += u * u;
        }
        const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX + 1e-8);
        const c = (sumY - m * sumX) / n;
        return { m, c };
      };

      const initialLine = fit(points);

      // Re-fit using only inliers within 2 pixels
      const inliers = points.filter((p) => {
        const u = fitYAsX ? p.y : p.x;
        const v = fitYAsX ? p.x : p.y;
        const expectedV = initialLine.m * u + initialLine.c;
        return Math.abs(v - expectedV) < 2.0;
      });

      if (inliers.length < 4) return initialLine;
      return fit(inliers);
    };

    const lineL = fitRobustLine(leftPoints, true);   // x = m_l * y + c_l
    const lineR = fitRobustLine(rightPoints, true);  // x = m_r * y + c_r
    const lineT = fitRobustLine(topPoints, false);   // y = m_t * x + c_t
    const lineB = fitRobustLine(bottomPoints, false); // y = m_b * x + c_b

    if (!lineL || !lineR || !lineT || !lineB) {
      return fallback;
    }

    // 6. Calculate intersections to find 4 virtual corners
    const intersect = (
      m_h: number, c_h: number, // horizontal line (T or B): y = m_h * x + c_h
      m_v: number, c_v: number  // vertical line (L or R):   x = m_v * y + c_v
    ): Point => {
      const denom = 1 - m_h * m_v;
      const y = Math.abs(denom) < 1e-5 ? (scanH / 2) : (m_h * c_v + c_h) / denom;
      const x = m_v * y + c_v;
      return { x: x / scanW, y: y / scanH };
    };

    const tl = intersect(lineT.m, lineT.c, lineL.m, lineL.c);
    const tr = intersect(lineT.m, lineT.c, lineR.m, lineR.c);
    const br = intersect(lineB.m, lineB.c, lineR.m, lineR.c);
    const bl = intersect(lineB.m, lineB.c, lineL.m, lineL.c);

    // Verify values are sane (within 0..1 range)
    const isValid = (p: Point) => p.x >= -0.05 && p.x <= 1.05 && p.y >= -0.05 && p.y <= 1.05;
    if (isValid(tl) && isValid(tr) && isValid(br) && isValid(bl)) {
      // Clamp corners inside boundaries
      const clamp = (val: number) => Math.max(0, Math.min(1, val));
      return [
        { x: clamp(tl.x), y: clamp(tl.y) },
        { x: clamp(tr.x), y: clamp(tr.y) },
        { x: clamp(br.x), y: clamp(br.y) },
        { x: clamp(bl.x), y: clamp(bl.y) }
      ];
    }
  } catch (err) {
    console.error("Lỗi tự động phát hiện góc bằng linear fitting:", err);
  }

  return fallback;
}

// Automatically detect document/CCCD corners using OpenCV.js (Otsu binarization + Convex Hull)
export function detectDocumentCornersOpenCV(imgElement: HTMLImageElement): Point[] | null {
  const cv = (window as any).cv;
  if (!cv || !cv.Mat) return null;

  let src: any = null;
  let dst: any = null;
  let contours: any = null;
  let hierarchy: any = null;

  try {
    src = cv.imread(imgElement);
    const maxDim = 400; // slightly higher resolution for better edge accuracy
    let dsize;
    if (src.cols > src.rows) {
      dsize = new cv.Size(maxDim, Math.round((src.rows / src.cols) * maxDim));
    } else {
      dsize = new cv.Size(Math.round((src.cols / src.rows) * maxDim), maxDim);
    }

    // Resize for speed and noise reduction
    dst = new cv.Mat();
    cv.resize(src, dst, dsize, 0, 0, cv.INTER_AREA);

    // Grayscale
    cv.cvtColor(dst, dst, cv.COLOR_RGBA2GRAY, 0);

    // Gaussian Blur to remove texture noise
    let ksize = new cv.Size(5, 5);
    cv.GaussianBlur(dst, dst, ksize, 0, 0, cv.BORDER_DEFAULT);

    // Otsu's thresholding to get clear card boundary silhouette
    cv.threshold(dst, dst, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);

    // Check if background is light/white (e.g. if corners of the binary image are white), invert it
    // so that the document is white (255) and the background is black (0)
    const cornersSum = dst.ucharAt(0, 0) +
      dst.ucharAt(0, dst.cols - 1) +
      dst.ucharAt(dst.rows - 1, 0) +
      dst.ucharAt(dst.rows - 1, dst.cols - 1);
    if (cornersSum > 510) { // If at least 2 corners are white (510 = 2 * 255)
      cv.bitwise_not(dst, dst);
    }

    // Morphology close to fill any holes inside the card
    let M = cv.Mat.ones(5, 5, cv.CV_8U);
    cv.morphologyEx(dst, dst, cv.MORPH_CLOSE, M);
    M.delete();

    // Find contours (RETR_EXTERNAL to only get the outer card boundary)
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(dst, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let maxArea = 0;
    let bestContourIdx = -1;

    for (let i = 0; i < contours.size(); ++i) {
      let contour = contours.get(i);
      let area = cv.contourArea(contour);
      if (area > maxArea) {
        maxArea = area;
        bestContourIdx = i;
      }
    }

    // If we found a largest outer contour that takes up at least 6% of the screen
    if (bestContourIdx !== -1 && maxArea > dsize.width * dsize.height * 0.06) {
      let contour = contours.get(bestContourIdx);

      // Calculate convex hull to smooth out rounded corners and get the geometric envelope
      let hull = new cv.Mat();
      cv.convexHull(contour, hull, false, true);

      let pts: Point[] = [];
      for (let i = 0; i < hull.rows; i++) {
        let x = hull.data32S[i * 2];
        let y = hull.data32S[i * 2 + 1];
        pts.push({ x: x / dsize.width, y: y / dsize.height });
      }
      hull.delete();

      // Find the 4 extreme diagonal projection points of the hull
      let tl = { x: 1, y: 1, val: 2 };
      let tr = { x: 0, y: 1, val: 0 };
      let br = { x: 0, y: 0, val: -2 };
      let bl = { x: 1, y: 0, val: 2 };

      for (let p of pts) {
        let sum = p.x + p.y;
        let diff = p.x - p.y;

        // TL minimizes x + y
        if (sum < tl.val) tl = { x: p.x, y: p.y, val: sum };
        // TR maximizes x - y
        if (diff > tr.val) tr = { x: p.x, y: p.y, val: diff };
        // BR maximizes x + y
        if (sum > br.val) br = { x: p.x, y: p.y, val: sum };
        // BL minimizes x - y
        if (diff < bl.val) bl = { x: p.x, y: p.y, val: diff };
      }

      // Add a tiny padding (e.g. 1%) outward from corners to keep card margins clean
      const padX = 0.01;
      const padY = 0.01;

      return [
        { x: Math.max(0, tl.x - padX), y: Math.max(0, tl.y - padY) }, // TL
        { x: Math.min(1, tr.x + padX), y: Math.max(0, tr.y - padY) }, // TR
        { x: Math.min(1, br.x + padX), y: Math.min(1, br.y + padY) }, // BR
        { x: Math.max(0, bl.x - padX), y: Math.min(1, bl.y + padY) }, // BL
      ];
    }
  } catch (err) {
    console.error("OpenCV corner detection error:", err);
  } finally {
    // Prevent WebAssembly memory leaks
    if (src) src.delete();
    if (dst) dst.delete();
    if (contours) contours.delete();
    if (hierarchy) hierarchy.delete();
  }

  return null;
}
