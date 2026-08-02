import type { Html5QrcodeCameraScanConfig } from "html5-qrcode";

export const CCCD_LIVE_SCAN_CONFIG: Html5QrcodeCameraScanConfig = {
  fps: 10,
  disableFlip: false,
  qrbox: (viewfinderWidth, viewfinderHeight) => {
    const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.46);
    return { width: size, height: size };
  },
  videoConstraints: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
};

export const optimizeCccdCameraTrack = async (containerId: string) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const video = document.querySelector<HTMLVideoElement>(`#${containerId} video`);
    const track = (video?.srcObject as MediaStream | null)?.getVideoTracks?.()[0];
    if (track) {
      const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & {
        focusMode?: string[];
      };
      const advanced: Record<string, unknown> = {};
      if (capabilities?.focusMode?.includes("continuous")) advanced.focusMode = "continuous";
      if (Object.keys(advanced).length > 0) {
        await track.applyConstraints({ advanced: [advanced] as MediaTrackConstraintSet[] }).catch(() => undefined);
      }
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 120));
  }
};

export const stopCccdCameraTracks = (containerId: string) => {
  const video = document.querySelector<HTMLVideoElement>(`#${containerId} video`);
  const stream = video?.srcObject as MediaStream | null;
  stream?.getTracks().forEach((track) => track.stop());
  if (video) video.srcObject = null;
};
