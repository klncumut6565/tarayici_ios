/// <reference lib="webworker" />

// KENAR ALGILAMA — OpenCV/WASM YOK.
//
// Önceki sürüm (v2) satır/sütun projeksiyonuyla sadece EKSENE PARALEL
// (axis-aligned) bir kutu buluyordu. Bu, belge kameraya paralel/düz
// tutulduğunda işe yarıyordu ama YAMUK/AÇILI çekimlerde ya arka planı
// içine alıyor ya da belgeyi tam kapsamıyordu — çünkü döndürülmüş bir
// dikdörtgenin ekseneye paralel sınırlayıcı kutusu, gerçek kenarlarla
// örtüşmez.
//
// Bu sürüm (v3) gerçek bir DÖNDÜRÜLMÜŞ dikdörtgen buluyor, tamamen saf
// JS/TypedArray ile, OpenCV'nin ~8-10MB WASM'ı olmadan:
//
//   1) "Kağıt gibi" piksel maskesi çıkar (parlaklık + düşük doygunluk)
//   2) Maskedeki EN BÜYÜK bağlı bileşeni bul (flood fill, tek geçiş
//      yığın tabanlı — küçük parazit lekelerini eler)
//   3) O bileşenin sınır (boundary) piksellerini topla — iç dolgu değil,
//      sadece dış hat (bu, sonraki adımı O(çevre) yapar, O(alan) değil)
//   4) Sınır noktalarının DIŞBÜKEY GÖVDESİNİ (convex hull) çıkar
//      (monotone chain, O(n log n))
//   5) "Rotating calipers" ile gövdeyi saran EN KÜÇÜK ALANLI döndürülmüş
//      dikdörtgeni bul (klasik hesaplamalı geometri algoritması —
//      OpenCV'nin minAreaRect'i de bunu yapar, ama biz kendi
//      implementasyonumuzu kullanıyoruz)
//
// Toplam bellek: birkaç Float32Array/Uint8Array, downscale edilmiş
// görüntü boyutunda (tipik ~900x700 = ~2.5MB toplam). WASM indirme/
// başlatma yok, tarayıcı motoru dışında ek çalışma zamanı yok.

interface Point {
  x: number;
  y: number;
}

interface RequestMsg {
  id: number;
  imageData: ImageData;
  /** "live": kamera önizlemesinde sık/düşük-çözünürlüklü tarama. "capture": çekim sonrası tek seferlik, daha toleranslı. */
  mode: "live" | "capture";
}

interface DetectResult {
  corners: [Point, Point, Point, Point] | null;
  debug: string;
}

// ---------------------------------------------------------------------
// 1) Kağıt maskesi
// ---------------------------------------------------------------------

function buildPaperMask(imageData: ImageData): { mask: Uint8Array; paperCount: number; brightnessThreshold: number } {
  const { width: w, height: h, data } = imageData;
  const n = w * h;

  const brightness = new Float32Array(n);
  const saturation = new Float32Array(n);
  let brightSum = 0;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    brightness[i] = (r + g + b) / 3;
    saturation[i] = maxC - minC;
    brightSum += brightness[i];
  }
  const avgBrightness = brightSum / n;
  const brightnessThreshold = Math.min(235, Math.max(115, avgBrightness * 0.8));
  const saturationThreshold = 65;

  const mask = new Uint8Array(n);
  let paperCount = 0;
  for (let i = 0; i < n; i++) {
    if (brightness[i] >= brightnessThreshold && saturation[i] <= saturationThreshold) {
      mask[i] = 1;
      paperCount++;
    }
  }

  return { mask, paperCount, brightnessThreshold };
}

// ---------------------------------------------------------------------
// 2) En büyük bağlı bileşen (iterative flood fill, yığın Int32Array)
// ---------------------------------------------------------------------

function largestComponent(mask: Uint8Array, w: number, h: number): { label: Int32Array; mainLabel: number; mainSize: number } {
  const n = w * h;
  const label = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  let nextLabel = 0;
  let bestLabel = -1;
  let bestSize = 0;

  for (let start = 0; start < n; start++) {
    if (mask[start] !== 1 || label[start] !== -1) continue;

    let sp = 0;
    stack[sp++] = start;
    label[start] = nextLabel;
    let size = 0;

    while (sp > 0) {
      const idx = stack[--sp];
      size++;
      const x = idx % w;
      const y = (idx - x) / w;

      // 4-komşuluk
      if (x > 0) {
        const ni = idx - 1;
        if (mask[ni] === 1 && label[ni] === -1) {
          label[ni] = nextLabel;
          stack[sp++] = ni;
        }
      }
      if (x < w - 1) {
        const ni = idx + 1;
        if (mask[ni] === 1 && label[ni] === -1) {
          label[ni] = nextLabel;
          stack[sp++] = ni;
        }
      }
      if (y > 0) {
        const ni = idx - w;
        if (mask[ni] === 1 && label[ni] === -1) {
          label[ni] = nextLabel;
          stack[sp++] = ni;
        }
      }
      if (y < h - 1) {
        const ni = idx + w;
        if (mask[ni] === 1 && label[ni] === -1) {
          label[ni] = nextLabel;
          stack[sp++] = ni;
        }
      }
    }

    if (size > bestSize) {
      bestSize = size;
      bestLabel = nextLabel;
    }
    nextLabel++;
  }

  return { label, mainLabel: bestLabel, mainSize: bestSize };
}

// ---------------------------------------------------------------------
// 3) Sınır (boundary) noktalarını topla
// ---------------------------------------------------------------------

function extractBoundaryPoints(label: Int32Array, mainLabel: number, w: number, h: number): Point[] {
  const points: Point[] = [];
  for (let y = 0; y < h; y++) {
    const base = y * w;
    for (let x = 0; x < w; x++) {
      const idx = base + x;
      if (label[idx] !== mainLabel) continue;
      const isEdge =
        x === 0 ||
        x === w - 1 ||
        y === 0 ||
        y === h - 1 ||
        label[idx - 1] !== mainLabel ||
        label[idx + 1] !== mainLabel ||
        label[idx - w] !== mainLabel ||
        label[idx + w] !== mainLabel;
      if (isEdge) points.push({ x, y });
    }
  }
  return points;
}

// ---------------------------------------------------------------------
// 4) Convex hull — monotone chain
// ---------------------------------------------------------------------

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function convexHull(pointsIn: Point[]): Point[] {
  const points = [...pointsIn].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const n = points.length;
  if (n < 3) return points;

  const lower: Point[] = [];
  for (const p of points) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const p = points[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// ---------------------------------------------------------------------
// 5) Rotating calipers — minimum alanlı döndürülmüş dikdörtgen
// ---------------------------------------------------------------------

function minAreaRect(hull: Point[]): { corners: [Point, Point, Point, Point]; area: number } | null {
  const n = hull.length;
  if (n < 3) return null;

  let best: { area: number; corners: [Point, Point, Point, Point] } | null = null;

  for (let i = 0; i < n; i++) {
    const p1 = hull[i];
    const p2 = hull[(i + 1) % n];
    const ex = p2.x - p1.x;
    const ey = p2.y - p1.y;
    const len = Math.hypot(ex, ey);
    if (len < 1e-6) continue;
    const ux = ex / len;
    const uy = ey / len;
    const vx = -uy;
    const vy = ux;

    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;

    for (const q of hull) {
      const rx = q.x - p1.x;
      const ry = q.y - p1.y;
      const u = rx * ux + ry * uy;
      const v = rx * vx + ry * vy;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }

    const width = maxU - minU;
    const height = maxV - minV;
    const area = width * height;

    if (!best || area < best.area) {
      const corner = (u: number, v: number): Point => ({
        x: p1.x + u * ux + v * vx,
        y: p1.y + u * uy + v * vy,
      });
      best = {
        area,
        corners: [corner(minU, minV), corner(maxU, minV), corner(maxU, maxV), corner(minU, maxV)],
      };
    }
  }

  return best;
}

/** Köşeleri sol-üst, sağ-üst, sağ-alt, sol-alt sırasına diz. */
function orderCorners(pts: [Point, Point, Point, Point]): [Point, Point, Point, Point] {
  const bySum = [...pts].sort((a, b) => a.x + a.y - (b.x + b.y));
  const tl = bySum[0];
  const br = bySum[3];
  const remaining = pts.filter((p) => p !== tl && p !== br);
  const [a, b] = remaining;
  const tr = a.x - a.y > b.x - b.y ? a : b;
  const bl = tr === a ? b : a;
  return [tl, tr, br, bl];
}

// ---------------------------------------------------------------------
// Ana algılama fonksiyonu
// ---------------------------------------------------------------------

function detect(imageData: ImageData, mode: "live" | "capture"): DetectResult {
  const { width: w, height: h } = imageData;
  const n = w * h;

  const { mask, paperCount, brightnessThreshold } = buildPaperMask(imageData);
  const minCoverage = mode === "live" ? 0.05 : 0.08;

  if (paperCount < n * minCoverage) {
    return {
      corners: null,
      debug: `Yeterince parlak/beyaz bölge yok (kaplama %${((paperCount / n) * 100).toFixed(1)}).`,
    };
  }

  const { label, mainLabel, mainSize } = largestComponent(mask, w, h);
  if (mainLabel === -1) {
    return { corners: null, debug: "Bağlı bileşen bulunamadı." };
  }

  const minComponentFraction = mode === "live" ? 0.12 : 0.2;
  if (mainSize < n * minComponentFraction) {
    return {
      corners: null,
      debug: `En büyük bölge çok küçük (alan %${((mainSize / n) * 100).toFixed(1)}). Belgeyi çerçeveye yaklaştır.`,
    };
  }

  const boundary = extractBoundaryPoints(label, mainLabel, w, h);
  if (boundary.length < 8) {
    return { corners: null, debug: "Sınır noktası yetersiz." };
  }

  const hull = convexHull(boundary);
  if (hull.length < 3) {
    return { corners: null, debug: "Dışbükey gövde çıkarılamadı." };
  }

  const rect = minAreaRect(hull);
  if (!rect) {
    return { corners: null, debug: "Döndürülmüş dikdörtge bulunamadı." };
  }

  // Bulunan dikdörtgenin alanı görüntüye kıyasla makul mü? (çok ince/
  // uzun ya da tüm kareyi kaplayan yanlış sonuçları ele)
  const areaRatio = rect.area / n;
  if (areaRatio < 0.15 || areaRatio > 0.97) {
    return {
      corners: null,
      debug: `Bulunan dikdörtgen oranı şüpheli (%${(areaRatio * 100).toFixed(1)}).`,
    };
  }

  const ordered = orderCorners(rect.corners);
  const debug = `Başarılı: alan oranı %${(areaRatio * 100).toFixed(1)}, hull=${hull.length} nokta, eşik=${brightnessThreshold.toFixed(0)}.`;

  return { corners: ordered, debug };
}

self.onmessage = (e: MessageEvent<RequestMsg>) => {
  const { id, imageData, mode } = e.data;
  try {
    const result = detect(imageData, mode ?? "capture");
    (self as unknown as Worker).postMessage({ id, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    (self as unknown as Worker).postMessage({ id, corners: null, debug: `Beklenmeyen hata: ${msg}` });
  }
};
