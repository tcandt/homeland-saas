// The bundled scanner reads canvas pixels repeatedly. Keep this default inside its iframe.
(() => {
  for (const Canvas of [globalThis.HTMLCanvasElement, globalThis.OffscreenCanvas]) {
    if (!Canvas) continue;
    const original = Canvas.prototype.getContext;
    Canvas.prototype.getContext = function (type, options, ...rest) {
      return type === "2d"
        ? original.call(this, type, { ...options, willReadFrequently: options?.willReadFrequently ?? true }, ...rest)
        : original.call(this, type, options, ...rest);
    };
  }
})();
