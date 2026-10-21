import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const bootstrap = readFileSync(new URL("../../public/qr/canvas-readback.js", import.meta.url), "utf8");

describe("scanner-only canvas readback default", () => {
  it("sets the default before the scanner bundle loads", () => {
    const html = readFileSync(new URL("../../public/qr/index.html", import.meta.url), "utf8");
    expect(html.indexOf("canvas-readback.js")).toBeLessThan(html.indexOf('type="module"'));
  });
  it("covers canvas and offscreen readback without mutating options or WebGL", () => {
    class Canvas {
      getContext(...args: unknown[]) { return { canvas: this, args }; }
    }
    class Offscreen extends Canvas {}
    // Separate prototypes, as in browsers.
    Offscreen.prototype.getContext = Canvas.prototype.getContext;
    runInNewContext(bootstrap, { HTMLCanvasElement: Canvas, OffscreenCanvas: Offscreen });
    for (const canvas of [new Canvas(), new Offscreen()]) {
      const options = Object.freeze({ alpha: false });
      expect(canvas.getContext("2d", options)).toEqual({ canvas, args: ["2d", { alpha: false, willReadFrequently: true }] });
      expect(canvas.getContext("2d", { willReadFrequently: false }).args[1]).toEqual({ willReadFrequently: false });
      expect(canvas.getContext("webgl", options).args).toEqual(["webgl", options]);
    }
  });
  it("supports browsers without OffscreenCanvas", () => {
    expect(() => runInNewContext(bootstrap, {})).not.toThrow();
  });
});
