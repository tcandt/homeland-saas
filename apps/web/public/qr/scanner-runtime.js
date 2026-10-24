// Keep asynchronous runtime/image failures observable by the embedding modal.
(() => {
  function waitForOpenCv(cv, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeoutMs;
      const check = () => {
        if (typeof cv?.Mat === "function" && typeof cv?.imread === "function") {
          resolve();
        } else if (Date.now() >= deadline) {
          reject(new Error("CCCD_OPENCV_INITIALIZATION_TIMEOUT"));
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
  }

  function loadImage(url, process) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        Promise.resolve().then(() => process(image)).then(resolve, reject)
          .finally(() => URL.revokeObjectURL(url));
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("CCCD_IMAGE_LOAD_FAILED"));
      };
      image.src = url;
    });
  }

  window.CCCDScannerRuntime = { waitForOpenCv, loadImage };
})();
