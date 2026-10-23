// Screenshot-fidelity check: captures a route at the reference viewport (1440 × 900 at 2×, the size of every
// reference image) and compares it with a reference screenshot. Uses Playwright's Chromium for capture and
// decoding, so no extra dependencies are needed.
//
//   node scripts/visual-diff.mjs --url http://localhost:3001/orders --ref "<absolute path to .jpeg>" --out .visual/orders
//   optional: --region x,y,w,h   (CSS px at 1440 × 900, e.g. 240,0,1200,900 to skip the sidebar)
//             --wait 500         (extra ms after fonts load)
//
// Writes <out>/ours.png and <out>/compare.png (reference | ours | diff) and prints the mean channel difference
// (0–255) and the share of pixels differing by more than 40. Ignore the annotation labels (D3) when reading it.
import { mkdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";

import { chromium } from "@playwright/test";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
);
if (!args.url || !args.ref || !args.out) {
  console.error("Usage: node scripts/visual-diff.mjs --url <url> --ref <reference image> --out <dir> [--region x,y,w,h] [--wait ms]");
  process.exit(1);
}

const out = resolve(args.out);
mkdirSync(out, { recursive: true });
const [rx, ry, rw, rh] = (args.region ?? "0,0,1440,900").split(",").map(Number);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(args.url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(Number(args.wait ?? 500));
  const ours = await page.screenshot();
  await page.screenshot({ path: join(out, "ours.png") });

  const mime = extname(args.ref).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
  const refData = `data:${mime};base64,${readFileSync(args.ref).toString("base64")}`;
  const oursData = `data:image/png;base64,${ours.toString("base64")}`;

  const diffPage = await browser.newPage();
  const result = await diffPage.evaluate(
    async ({ refData, oursData, region }) => {
      const load = (src) => new Promise((ok, fail) => Object.assign(new Image(), { onload() { ok(this); }, onerror: fail, src }));
      const [refImg, ourImg] = await Promise.all([load(refData), load(oursData)]);
      const [x, y, w, h] = region.map((v) => v * 2);
      const pixels = (img) => {
        const c = new OffscreenCanvas(w, h);
        const ctx = c.getContext("2d");
        ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
        return ctx.getImageData(0, 0, w, h);
      };
      const a = pixels(refImg);
      const b = pixels(ourImg);
      const diff = new ImageData(w, h);
      let sum = 0;
      let big = 0;
      for (let i = 0; i < a.data.length; i += 4) {
        const d = (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])) / 3;
        sum += d;
        if (d > 40) big++;
        const v = Math.min(255, d * 3);
        diff.data.set([255, 255 - v, 255 - v, 255], i);
      }
      const composite = new OffscreenCanvas(w * 3, h);
      const ctx = composite.getContext("2d");
      ctx.putImageData(a, 0, 0);
      ctx.putImageData(b, w, 0);
      ctx.putImageData(diff, w * 2, 0);
      const blob = await composite.convertToBlob({ type: "image/png" });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { mean: sum / (w * h), share: (100 * big) / (w * h), png: btoa(binary) };
    },
    { refData, oursData, region: [rx, ry, rw, rh] },
  );
  const { writeFileSync } = await import("node:fs");
  writeFileSync(join(out, "compare.png"), Buffer.from(result.png, "base64"));
  console.log(`region ${rx},${ry},${rw}x${rh}: mean diff ${result.mean.toFixed(1)}/255, pixels >40: ${result.share.toFixed(2)}%`);
  console.log(`wrote ${join(out, "ours.png")} and ${join(out, "compare.png")} (reference | ours | diff)`);
} finally {
  await browser.close();
}
