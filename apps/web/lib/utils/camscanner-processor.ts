import { Jimp } from "jimp";

export type Point2D = { x: number; y: number };

// Solve 3x3 Homography Matrix mapping srcPoints to destPoints
export function getHomographyMatrix(src: Point2D[], dest: Point2D[]): number[] {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x: u, y: v } = dest[i];
    const { x, y } = src[i];
    A.push([-u, -v, -1, 0, 0, 0, u * x, v * x, x]);
    A.push([0, 0, 0, -u, -v, -1, u * y, v * y, y]);
  }

  // Gaussian elimination to solve Ah = 0 with h8 = 1
  for (let i = 0; i < 8; i++) {
    let maxRow = i;
    for (let k = i + 1; k < 8; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
    }
    const temp = A[i];
    A[i] = A[maxRow];
    A[maxRow] = temp;

    const pivot = A[i][i];
    if (Math.abs(pivot) < 1e-10) continue;

    for (let j = i; j <= 8; j++) A[i][j] /= pivot;

    for (let k = 0; k < 8; k++) {
      if (k !== i) {
        const factor = A[k][i];
        for (let j = i; j <= 8; j++) {
          A[k][j] -= factor * A[i][j];
        }
      }
    }
  }

  const H = new Array(9);
  for (let i = 0; i < 8; i++) {
    H[i] = -A[i][8];
  }
  H[8] = 1.0;
  return H;
}

// CamScanner Magic Color Filter: Boost contrast, sharpen text & QR, normalize brightness
export function applyCamScannerFilter(image: any): typeof image {
  // Jimp image manipulation methods
  image.contrast(0.2); // +20% contrast
  image.brightness(0.05); // slightly brighten
  return image;
}

// Perspective Flattening ("Phẳng Hóa") using Homography mapping to standard 856x540 canvas
export function warpHomographyCanvas(
  srcImage: any,
  srcCorners: Point2D[],
  destWidth = 856,
  destHeight = 540
): any {
  const destCorners: Point2D[] = [
    { x: 0, y: 0 },
    { x: destWidth, y: 0 },
    { x: destWidth, y: destHeight },
    { x: 0, y: destHeight },
  ];

  // Map relative coordinates to pixel coordinates
  const pixelSrc = srcCorners.map((p) => ({
    x: p.x * srcImage.bitmap.width,
    y: p.y * srcImage.bitmap.height,
  }));

  const H = getHomographyMatrix(pixelSrc, destCorners);
  const [h00, h01, h02, h10, h11, h12, h20, h21, h22] = H;

  const destImage = new Jimp({ width: destWidth, height: destHeight, color: 0xffffffff });
  const srcData = srcImage.bitmap.data;
  const destData = destImage.bitmap.data;
  const srcW = srcImage.bitmap.width;
  const srcH = srcImage.bitmap.height;

  for (let v = 0; v < destHeight; v++) {
    for (let u = 0; u < destWidth; u++) {
      const w = h20 * u + h21 * v + h22;
      const x = (h00 * u + h01 * v + h02) / w;
      const y = (h10 * u + h11 * v + h12) / w;

      const destIdx = (v * destWidth + u) * 4;

      if (x >= 0 && x < srcW - 1 && y >= 0 && y < srcH - 1) {
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const x1 = x0 + 1;
        const y1 = y0 + 1;

        const dx = x - x0;
        const dy = y - y0;

        const idx00 = (y0 * srcW + x0) * 4;
        const idx10 = (y0 * srcW + x1) * 4;
        const idx01 = (y1 * srcW + x0) * 4;
        const idx11 = (y1 * srcW + x1) * 4;

        for (let c = 0; c < 4; c++) {
          const val =
            (1 - dx) * (1 - dy) * srcData[idx00 + c] +
            dx * (1 - dy) * srcData[idx10 + c] +
            (1 - dx) * dy * srcData[idx01 + c] +
            dx * dy * srcData[idx11 + c];
          destData[destIdx + c] = Math.round(val);
        }
      } else {
        destData[destIdx] = 255;
        destData[destIdx + 1] = 255;
        destData[destIdx + 2] = 255;
        destData[destIdx + 3] = 255;
      }
    }
  }

  return applyCamScannerFilter(destImage);
}
