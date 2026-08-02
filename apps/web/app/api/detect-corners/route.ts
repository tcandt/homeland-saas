import { NextRequest, NextResponse } from "next/server";
import { Jimp } from "jimp";
import cvPromise from "@techstark/opencv-js";

function orderCorners(pts: { x: number; y: number }[]) {
  // Sort points: sum (x+y) min is TL, max is BR
  pts.sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const tl = pts[0];
  const br = pts[3];

  const remaining = [pts[1], pts[2]];
  remaining.sort((a, b) => (a.x - a.y) - (b.x - b.y));
  const bl = remaining[0];
  const tr = remaining[1];

  return [tl, tr, br, bl];
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Read image using Jimp
    const image = await Jimp.read(buffer);
    
    // Downscale for performance and noise reduction
    const MAX_DIM = 800;
    if (image.bitmap.width > MAX_DIM || image.bitmap.height > MAX_DIM) {
      if (image.bitmap.width > image.bitmap.height) {
        image.resize({ w: MAX_DIM });
      } else {
        image.resize({ h: MAX_DIM });
      }
    }

    const { width, height, data } = image.bitmap;
    
    // Resolve OpenCV WebAssembly Promise
    const cv = await cvPromise;
    
    // Create OpenCV Mat from Jimp image data (RGBA)
    const src = new cv.Mat(height, width, cv.CV_8UC4);
    src.data.set(new Uint8Array(data));

    const hsv = new cv.Mat();
    const maskCyan = new cv.Mat();
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const edges = new cv.Mat();
    const dilated = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(9, 9));

    let resultCorners: { x: number; y: number }[] | null = null;

    try {
      // Strategy 1: Cyan Pattern Detection + Card Aspect Ratio Expansion (Standard 1.586)
      cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
      cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

      // Cyan/Turquoise range for Vietnamese CCCD (Hue 65-135)
      const lowCyan = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [65, 15, 30, 0]);
      const highCyan = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [135, 255, 255, 0]);
      cv.inRange(hsv, lowCyan, highCyan, maskCyan);

      // Clean mask
      cv.morphologyEx(maskCyan, maskCyan, cv.MORPH_CLOSE, kernel);

      cv.findContours(maskCyan, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      let maxArea = 0;
      let bestContourIdx = -1;

      for (let i = 0; i < contours.size(); ++i) {
        const cnt = contours.get(i);
        const area = cv.contourArea(cnt);
        if (area > (width * height) * 0.03 && area > maxArea) {
          maxArea = area;
          bestContourIdx = i;
        }
        cnt.delete();
      }

      lowCyan.delete();
      highCyan.delete();

      if (bestContourIdx !== -1) {
        const contours2 = new cv.MatVector();
        const hierarchy2 = new cv.Mat();
        cv.findContours(maskCyan, contours2, hierarchy2, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        const bestCnt = contours2.get(bestContourIdx);

        const rotatedRect = cv.minAreaRect(bestCnt);

        let cx = rotatedRect.center.x;
        let cy = rotatedRect.center.y;
        let w = rotatedRect.size.width;
        let h = rotatedRect.size.height;
        let angle = rotatedRect.angle;

        // Normalize orientation so w is the long side of the card
        if (w < h) {
          const tmp = w; w = h; h = tmp;
          angle += 90;
        }

        // Standard Vietnamese CCCD Ratio is 1.586 (85.6mm / 53.98mm)
        const expectedFullW = h * 1.586;

        // The cyan pattern is on the right ~65% of the card.
        // If detected width is shorter than full card width, shift center left along card's horizontal angle to include portrait photo
        if (w < expectedFullW * 0.95) {
          const missingW = expectedFullW - w;
          const rad = (angle * Math.PI) / 180;
          cx -= Math.cos(rad) * (missingW * 0.75);
          cy -= Math.sin(rad) * (missingW * 0.75);
          w = expectedFullW;
        }

        const rad = (angle * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const dx = w / 2;
        const dy = h / 2;
        const unrotated = [
          { x: -dx, y: -dy },
          { x:  dx, y: -dy },
          { x:  dx, y:  dy },
          { x: -dx, y:  dy }
        ];

        const pts = unrotated.map(pt => ({
          x: Math.max(0, Math.min(1, (cx + pt.x * cos - pt.y * sin) / width)),
          y: Math.max(0, Math.min(1, (cy + pt.x * sin + pt.y * cos) / height)),
        }));

        bestCnt.delete();
        contours2.delete();
        hierarchy2.delete();

        resultCorners = orderCorners(pts);
      }

      // Strategy 2: Canny Edge Detection Fallback
      if (!resultCorners) {
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
        cv.medianBlur(gray, blurred, 7);
        cv.GaussianBlur(blurred, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
        cv.Canny(blurred, edges, 30, 120, 3, false);
        cv.morphologyEx(edges, dilated, cv.MORPH_CLOSE, kernel);
        cv.findContours(dilated, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

        let maxCannyArea = 0;
        let bestPoly = new cv.Mat();
        let foundPoly = false;

        for (let i = 0; i < contours.size(); ++i) {
          const cnt = contours.get(i);
          const area = cv.contourArea(cnt);

          if (area < (width * height) * 0.1) {
            cnt.delete();
            continue;
          }

          const peri = cv.arcLength(cnt, true);
          const approx = new cv.Mat();
          cv.approxPolyDP(cnt, approx, 0.03 * peri, true);

          if (approx.rows === 4 && area > maxCannyArea) {
            if (cv.isContourConvex(approx)) {
              maxCannyArea = area;
              approx.copyTo(bestPoly);
              foundPoly = true;
            }
          }

          approx.delete();
          cnt.delete();
        }

        if (foundPoly) {
          const polyData = bestPoly.data32S;
          const pts = [];
          for (let i = 0; i < 4; i++) {
            pts.push({
              x: Math.max(0, Math.min(1, polyData[i * 2] / width)),
              y: Math.max(0, Math.min(1, polyData[i * 2 + 1] / height)),
            });
          }
          resultCorners = orderCorners(pts);
        }
        bestPoly.delete();
      }

      return NextResponse.json({
        success: true,
        corners: resultCorners
      });

    } finally {
      src.delete();
      hsv.delete();
      maskCyan.delete();
      gray.delete();
      blurred.delete();
      edges.delete();
      dilated.delete();
      contours.delete();
      hierarchy.delete();
      kernel.delete();
    }

  } catch (error: any) {
    console.error("Error in detect-corners API:", error);
    return NextResponse.json(
      { error: "Failed to process image", details: error.message },
      { status: 500 }
    );
  }
}
