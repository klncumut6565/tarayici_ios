import type { FilterType } from "./types";

export interface Point {
  x: number;
  y: number;
}

/**
 * Bir üçgeni kaynaktan hedefe eşleyen affine matrisi hesaplar ve
 * context'e uygular. Dörtgeni iki üçgene bölerek (TL-TR-BL, TR-BR-BL)
 * canvas'ın yerel 2D API'siyle perspektif benzeri bir warp elde ederiz.
 */
function drawTriangle(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  src: [Point, Point, Point],
  dst: [Point, Point, Point]
) {
  const [s0, s1, s2] = src;
  const [d0, d1, d2] = dst;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();

  // Kaynak üçgenden hedef üçgene affine dönüşüm katsayılarını çöz.
  const denom = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (denom === 0) {
    ctx.restore();
    return;
  }

  const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / denom;
  const b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / denom;
  const c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / denom;
  const d = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / denom;
  const e =
    (d0.x * (s1.x * s2.y - s2.x * s1.y) +
      d1.x * (s2.x * s0.y - s0.x * s2.y) +
      d2.x * (s0.x * s1.y - s1.x * s0.y)) /
    denom;
  const f =
    (d0.y * (s1.x * s2.y - s2.x * s1.y) +
      d1.y * (s2.x * s0.y - s0.x * s2.y) +
      d2.y * (s0.x * s1.y - s1.x * s0.y)) /
    denom;

  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/**
 * 4 köşe noktasıyla belirlenen dörtgen bölgeyi düz bir dikdörtgene
 * "düzleştirir" (perspektif düzeltme). corners sırası: sol-üst, sağ-üst,
 * sağ-alt, sol-alt.
 */
export function warpToRectangle(
  source: CanvasImageSource,
  corners: [Point, Point, Point, Point],
  outWidth: number,
  outHeight: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext("2d")!;

  const [tl, tr, br, bl] = corners;
  const dTL = { x: 0, y: 0 };
  const dTR = { x: outWidth, y: 0 };
  const dBR = { x: outWidth, y: outHeight };
  const dBL = { x: 0, y: outHeight };

  drawTriangle(ctx, source, [tl, tr, bl], [dTL, dTR, dBL]);
  drawTriangle(ctx, source, [tr, br, bl], [dTR, dBR, dBL]);

  return canvas;
}

/**
 * Kanal başına histogram üzerinden düşük/yüksek yüzdelik dilim (percentile)
 * değerlerini bulur. Bu, "beyaz nokta" (kağıdın en parlak tonu) ve "siyah
 * nokta"nın (mürekkep/gölgenin en koyu tonu) otomatik tespiti içindir —
 * gerçek tarayıcı uygulamalarının kağıdı beyaza çekmek için kullandığı
 * yöntemin aynısı (auto-levels / white point correction).
 */
function computeChannelLevels(data: Uint8ClampedArray, lowPct = 0.02, highPct = 0.98) {
  const histR = new Array(256).fill(0);
  const histG = new Array(256).fill(0);
  const histB = new Array(256).fill(0);
  const total = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    histR[data[i]]++;
    histG[data[i + 1]]++;
    histB[data[i + 2]]++;
  }

  function percentile(hist: number[], pct: number) {
    const target = total * pct;
    let cum = 0;
    for (let v = 0; v < 256; v++) {
      cum += hist[v];
      if (cum >= target) return v;
    }
    return 255;
  }

  return {
    loR: percentile(histR, lowPct),
    hiR: percentile(histR, highPct),
    loG: percentile(histG, lowPct),
    hiG: percentile(histG, highPct),
    loB: percentile(histB, lowPct),
    hiB: percentile(histB, highPct),
  };
}

export function applyFilter(
  canvas: HTMLCanvasElement,
  filter: FilterType,
  brightness = 0,
  contrast = 0
): HTMLCanvasElement {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  // "Belge" filtresi: kanal başına otomatik seviye germe. Kağıdın en
  // parlak tonunu 255'e (beyaz), mürekkebin en koyu tonunu ~0'a çeker.
  // Aynı zamanda kanallar ayrı ayrı gerildiği için düşük ışıkta oluşan
  // renk kaymasını (sarı/gri baskın görüntü) da düzeltir.
  const MIN_RANGE = 25;
  let levels: ReturnType<typeof computeChannelLevels> | null = null;
  if (filter === "belge") {
    levels = computeChannelLevels(data);
  }

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (levels) {
      const hiR = Math.max(levels.hiR, levels.loR + MIN_RANGE);
      const hiG = Math.max(levels.hiG, levels.loG + MIN_RANGE);
      const hiB = Math.max(levels.hiB, levels.loB + MIN_RANGE);
      r = ((r - levels.loR) / (hiR - levels.loR)) * 255;
      g = ((g - levels.loG) / (hiG - levels.loG)) * 255;
      b = ((b - levels.loB) / (hiB - levels.loB)) * 255;
      // Hafif gamma kaldırması: orta tonları biraz daha aydınlatır, kağıt
      // dokusundaki hafif gölgeleri de beyaza yaklaştırır.
      r = 255 * Math.pow(clamp(r) / 255, 0.9);
      g = 255 * Math.pow(clamp(g) / 255, 0.9);
      b = 255 * Math.pow(clamp(b) / 255, 0.9);
    }

    if (filter === "gri" || filter === "siyahbeyaz") {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = g = b = gray;
    }

    if (filter === "siyahbeyaz") {
      const threshold = 150;
      const v = r > threshold ? 255 : 0;
      r = g = b = v;
    }

    if (filter === "canlı") {
      r = Math.min(255, r * 1.15);
      g = Math.min(255, g * 1.1);
      b = Math.min(255, b * 1.05);
    }

    r = contrastFactor * (r - 128) + 128 + brightness;
    g = contrastFactor * (g - 128) + 128 + brightness;
    b = contrastFactor * (b - 128) + 128 + brightness;

    data[i] = clamp(r);
    data[i + 1] = clamp(g);
    data[i + 2] = clamp(b);
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function clamp(v: number) {
  return Math.max(0, Math.min(255, v));
}

export function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas blob oluşturulamadı"))),
      "image/jpeg",
      quality
    );
  });
}

export function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function rotateCanvas90(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const rotated = document.createElement("canvas");
  rotated.width = canvas.height;
  rotated.height = canvas.width;
  const ctx = rotated.getContext("2d")!;
  ctx.translate(rotated.width / 2, rotated.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return rotated;
}
