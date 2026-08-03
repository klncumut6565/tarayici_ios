/// <reference lib="webworker" />

// KENAR ALGILAMA v4 — OpenCV/WASM ve harici bir AI modeli YOK.
//
// v3'e göre iki iyileştirme:
//
// 1) OTSU EŞİKLEME: Önceki sürüm "ortalama parlaklığın %80'i" gibi sabit
//    bir çarpanla kağıt/arka-plan eşiği belirliyordu. Bu, aydınlatma
//    çok değiştiğinde (loş oda, pencere ışığı, gölgeli masa) zayıf
//    kalıyordu — "kenar yakalama zayıf" şikayetinin ana sebeplerinden
//    biri buydu. Otsu yöntemi, HER GÖRÜNTÜ İÇİN histogramdan optimal
//    eşiği otomatik hesaplar (klasik, kanıtlanmış, O(n) + O(256)
//    maliyetli — hâlâ milisaniyeler seviyesinde).
//
// 2) ÇOKLU ADAY + BOYUT/ORAN SKORLAMASI: Önceki sürüm sadece "en büyük
//    bağlı bileşeni" alıp onu belge sayıyordu. Arka plan da parlaksa
//    (beyaz masa vb.) yanlış/büyük bir bölge seçilebiliyordu. Artık en
//    büyük birkaç (≤6) bağlı bileşen adayının HER BİRİ için döndürülmüş
//    dikdörtgen hesaplanıyor ve kullanıcının seçtiği belge tipine göre
//    (A4 belge ≈ 1:1.41, Kimlik/Kart ≈ 1:1.586) BEKLENEN EN/BOY ORANINA
//    en yakın + yeterince büyük olan aday seçiliyor. Bu, "belge tipine
//    göre beklenen boyut" fikrini tam olarak karşılıyor: gerçek bir ML
//    modeli olmadan, geometrik bir önsel (prior) olarak kullanılıyor.
//
// Bu iki değişiklik de saf JS/TypedArray — indirilecek model yok, GPU/
// WebGL context açılmıyor, ek bellek ayak izi yaklaşık aynı kalıyor.

interface Point {
  x: number;
  y: number;
}

interface RequestMsg {
  id: number;
  imageData: ImageData;
  /** "live": kamera önizlemesinde sık/düşük-çözünürlüklü tarama. "capture": çekim sonrası tek seferlik, daha toleranslı. */
  mode: "live" | "capture";
  /** Beklenen en/boy oranı (genişlik/yükseklik), örn. A4 için ~0.707, kimlik için ~1.586. Verilmezse sadece alan büyüklüğüne göre seçilir. */
  expectedAspect?: number;
}

interface DetectResult {
  corners: [Point, Point, Point, Point] | null;
  debug: string;
}

// ---------------------------------------------------------------------
// 1) "Kağıt skoru" kanalı + Otsu eşikleme
// ---------------------------------------------------------------------

function buildPaperScoreAndHistogram(imageData: ImageData): { score: Float32Array; hist: Uint32Array } {
  const { width: w, height: h, data } = imageData;
  const n = w * h;
  const score = new Float32Array(n);
  const hist = new Uint32Array(256);

  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const brightness = (r + g + b) / 3;
    const saturation = maxC - minC;
    // Doygunluğu cezalandırarak "beyaz/gri kağıt gibi" pikselleri
    // öne çıkar: parlak + renksiz -> yüksek skor.
    const s = Math.max(0, Math.min(255, brightness - saturation * 0.9));
    score[i] = s;
    hist[Math.round(s)]++;
  }

  return { score, hist };
}

/** Klasik Otsu algoritması: histogramdan iki sınıfı en iyi ayıran eşiği bulur. */
function otsuThreshold(hist: Uint32Array, total: number): number {
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t];

  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);

    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }

  return threshold;
}

// ---------------------------------------------------------------------
// 2) Tüm bağlı bileşenler (en büyükten küçüğe, en fazla MAX_CANDIDATES tanesi)
// ---------------------------------------------------------------------

const MAX_CANDIDATES = 6;

function findComponents(
  mask: Uint8Array,
  w: number,
  h: number
): { label: Int32Array; components: { id: number; size: number }[] } {
  const n = w * h;
  const label = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  let nextLabel = 0;
  const components: { id: number; size: number }[] = [];

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

    components.push({ id: nextLabel, size });
    nextLabel++;
  }

  components.sort((a, b) => b.size - a.size);
  return { label, components: components.slice(0, MAX_CANDIDATES) };
}

// ---------------------------------------------------------------------
// 3) Sınır noktaları / Convex hull / Rotating calipers (v3 ile aynı, kanıtlanmış)
// ---------------------------------------------------------------------

function extractBoundaryPoints(label: Int32Array, targetLabel: number, w: number, h: number): Point[] {
  const points: Point[] = [];
  for (let y = 0; y < h; y++) {
    const base = y * w;
    for (let x = 0; x < w; x++) {
      const idx = base + x;
      if (label[idx] !== targetLabel) continue;
      const isEdge =
        x === 0 ||
        x === w - 1 ||
        y === 0 ||
        y === h - 1 ||
        label[idx - 1] !== targetLabel ||
        label[idx + 1] !== targetLabel ||
        label[idx - w] !== targetLabel ||
        label[idx + w] !== targetLabel;
      if (isEdge) points.push({ x, y });
    }
  }
  return points;
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function convexHull(pointsIn: Point[]): Point[] {
  const points = [...pointsIn].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const n = points.length;
  if (n < 3) return points;

  const lower: Point[] = [];
  for (const p of points) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const p = points[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

interface RectCandidate {
  corners: [Point, Point, Point, Point];
  area: number;
  width: number;
  height: number;
}

function minAreaRect(hull: Point[]): RectCandidate | null {
  const n = hull.length;
  if (n < 3) return null;

  let best: RectCandidate | null = null;

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
        width,
        height,
        corners: [corner(minU, minV), corner(maxU, minV), corner(maxU, maxV), corner(minU, maxV)],
      };
    }
  }

  return best;
}

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
// Aday skorlama: alan büyüklüğü + (varsa) beklenen en/boy oranına yakınlık
// ---------------------------------------------------------------------

function normalizedAspect(aspect: number): number {
  // Yönden (dikey/yatay çekim) bağımsız hale getir: her zaman <= 1.
  return aspect <= 1 ? aspect : 1 / aspect;
}

function scoreCandidate(
  rect: RectCandidate,
  imageArea: number,
  expectedAspect: number | undefined,
  minAreaRatio: number
): number {
  const areaRatio = rect.area / imageArea;
  if (areaRatio < minAreaRatio || areaRatio > 0.97) return -1; // çok küçük ya da tüm kareyi kaplıyor -> güvenilmez

  let score = areaRatio;

  if (expectedAspect !== undefined && rect.width > 0 && rect.height > 0) {
    const actual = normalizedAspect(rect.width / rect.height);
    const expected = normalizedAspect(expectedAspect);
    const logDiff = Math.abs(Math.log(actual / expected));
    // logDiff küçükse (oran tutuyorsa) skor artırılır; büyükse cezalandırılır.
    const aspectBonus = Math.exp(-logDiff * 3);
    score = areaRatio * 0.4 + aspectBonus * 0.6;
  }

  return score;
}

// ---------------------------------------------------------------------
// 6) KENAR OTURTMA (edge snapping) — sadece "capture" modunda
// ---------------------------------------------------------------------
//
// minAreaRect bize İYİ bir kaba tahmin verir ama dışbükey gövdenin
// (hull) noktalarına dayandığı için piksel-hassasiyetinde değildir.
// Çekim sonrası (canlı önizlemede DEĞİL — burada zaman bütçemiz var)
// her kenar boyunca ~14 noktada, kenara dik yönde küçük bir pencerede
// gerçek "kağıt skoru" (paperScore) profilini tarayıp Otsu eşiğinin
// TAM OLARAK nerede kesildiğini buluyoruz (alt-piksel interpolasyonla).
// Bu noktalara doğrusal regresyon uygulayıp her kenar için gerçek bir
// çizgi denklemi çıkarıyoruz, ardından komşu çizgileri kesiştirerek
// köşeleri güncelliyoruz. Bu, minAreaRect + kaba maskeden çok daha
// hassas — gerçek gradyan geçişine oturuyor. Yapay zeka/model yok,
// tamamen deterministik klasik görüntü işleme.

function bilinearSample(field: Float32Array, w: number, h: number, x: number, y: number): number {
  const cx = Math.min(Math.max(x, 0), w - 1.001);
  const cy = Math.min(Math.max(y, 0), h - 1.001);
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const fx = cx - x0;
  const fy = cy - y0;
  const v00 = field[y0 * w + x0];
  const v10 = field[y0 * w + x1];
  const v01 = field[y1 * w + x0];
  const v11 = field[y1 * w + x1];
  return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
}

/** Bir kenar üzerinde örnek noktalar toplayıp gerçek eşik geçişine oturtur. */
function refineEdgeLine(
  score: Float32Array,
  w: number,
  h: number,
  p1: Point,
  p2: Point,
  threshold: number
): { point: Point; dir: Point } | null {
  const ex = p2.x - p1.x;
  const ey = p2.y - p1.y;
  const edgeLen = Math.hypot(ex, ey);
  if (edgeLen < 4) return null;
  const dirX = ex / edgeLen;
  const dirY = ey / edgeLen;
  const normX = -dirY;
  const normY = dirX;

  const SAMPLES = 14;
  const SEARCH_R = Math.min(16, edgeLen * 0.15);
  const STEP = 0.5;

  const refined: Point[] = [];

  for (let s = 1; s < SAMPLES - 1; s++) {
    const t = s / (SAMPLES - 1);
    const bx = p1.x + ex * t;
    const by = p1.y + ey * t;

    // [-SEARCH_R, +SEARCH_R] boyunca skor profilini tara, eşik geçişini bul.
    let prevOffset = -SEARCH_R;
    let prevVal = bilinearSample(score, w, h, bx + normX * prevOffset, by + normY * prevOffset) - threshold;
    let bestOffset: number | null = null;
    let bestDist = Infinity;

    for (let off = -SEARCH_R + STEP; off <= SEARCH_R; off += STEP) {
      const val = bilinearSample(score, w, h, bx + normX * off, by + normY * off) - threshold;
      if ((prevVal > 0 && val <= 0) || (prevVal < 0 && val >= 0)) {
        // Alt-piksel interpolasyon: doğrusal geçiş noktası
        const denom = prevVal - val;
        const frac = Math.abs(denom) < 1e-6 ? 0.5 : prevVal / denom;
        const crossOffset = prevOffset + frac * STEP;
        if (Math.abs(crossOffset) < bestDist) {
          bestDist = Math.abs(crossOffset);
          bestOffset = crossOffset;
        }
      }
      prevOffset = off;
      prevVal = val;
    }

    if (bestOffset !== null) {
      refined.push({ x: bx + normX * bestOffset, y: by + normY * bestOffset });
    }
  }

  if (refined.length < 5) return null; // yeterli örnek yoksa güvenilmez, orijinali koru

  // Kenar kendi (u,v) uzayında doğrusal regresyon: v = a*u + b (dikey
  // kenarlarda da regresyon kararlı çalışsın diye kenar yönüne göre döndür).
  let sumU = 0, sumV = 0, sumUU = 0, sumUV = 0;
  const uvPoints = refined.map((p) => {
    const rx = p.x - p1.x;
    const ry = p.y - p1.y;
    const u = rx * dirX + ry * dirY;
    const v = rx * normX + ry * normY;
    sumU += u; sumV += v; sumUU += u * u; sumUV += u * v;
    return { u, v };
  });
  const nP = uvPoints.length;
  const denom = nP * sumUU - sumU * sumU;
  if (Math.abs(denom) < 1e-6) return null;
  const a = (nP * sumUV - sumU * sumV) / denom;
  const b = (sumV - a * sumU) / nP;

  // Regresyon çizgisi üstünde iki nokta seç, orijinal uzaya geri çevir.
  const u0 = 0, u1 = edgeLen;
  const toOriginal = (u: number, v: number): Point => ({
    x: p1.x + u * dirX + v * normX,
    y: p1.y + u * dirY + v * normY,
  });
  const linePt = toOriginal(u0, a * u0 + b);
  const lineDir = toOriginal(u1, a * u1 + b);

  return { point: linePt, dir: { x: lineDir.x - linePt.x, y: lineDir.y - linePt.y } };
}

/** İki çizgiyi (nokta + yön) kesiştirir. */
function intersectLines(l1: { point: Point; dir: Point }, l2: { point: Point; dir: Point }): Point | null {
  const { point: p1, dir: d1 } = l1;
  const { point: p2, dir: d2 } = l2;
  const denom = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(denom) < 1e-6) return null; // paralel, kesişmiyor
  const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / denom;
  return { x: p1.x + d1.x * t, y: p1.y + d1.y * t };
}

const MAX_REFINE_DISPLACEMENT = 22; // px (analiz çözünürlüğünde) — bundan fazla kayarsa güvenme, orijinali koru

function refineCorners(
  score: Float32Array,
  w: number,
  h: number,
  corners: [Point, Point, Point, Point],
  threshold: number
): [Point, Point, Point, Point] {
  const lines: (({ point: Point; dir: Point }) | null)[] = [];
  for (let i = 0; i < 4; i++) {
    lines.push(refineEdgeLine(score, w, h, corners[i], corners[(i + 1) % 4], threshold));
  }

  const result: Point[] = [...corners];
  for (let i = 0; i < 4; i++) {
    const prevLine = lines[(i - 1 + 4) % 4];
    const currLine = lines[i];
    if (!prevLine || !currLine) continue; // biri eksikse bu köşeyi orijinalde bırak
    const intersection = intersectLines(prevLine, currLine);
    if (!intersection) continue;
    const displacement = Math.hypot(intersection.x - corners[i].x, intersection.y - corners[i].y);
    if (displacement > MAX_REFINE_DISPLACEMENT) continue; // şüpheli, orijinali koru
    result[i] = intersection;
  }

  return result as [Point, Point, Point, Point];
}



function detect(imageData: ImageData, mode: "live" | "capture", expectedAspect: number | undefined): DetectResult {
  const { width: w, height: h } = imageData;
  const n = w * h;

  const { score, hist } = buildPaperScoreAndHistogram(imageData);
  const otsuT = otsuThreshold(hist, n);
  // Otsu bazen çok düşük bir eşik bulabilir (görüntüde gerçek iki-modlu
  // dağılım yoksa); mantıklı bir alt/üst sınırla koru.
  const threshold = Math.max(90, Math.min(235, otsuT));

  const mask = new Uint8Array(n);
  let paperCount = 0;
  for (let i = 0; i < n; i++) {
    if (score[i] >= threshold) {
      mask[i] = 1;
      paperCount++;
    }
  }

  const minCoverage = mode === "live" ? 0.05 : 0.08;
  if (paperCount < n * minCoverage) {
    return {
      corners: null,
      debug: `Yeterince parlak/beyaz bölge yok (kaplama %${((paperCount / n) * 100).toFixed(1)}, eşik=${threshold}).`,
    };
  }

  const { label, components } = findComponents(mask, w, h);
  if (components.length === 0) {
    return { corners: null, debug: "Bağlı bileşen bulunamadı." };
  }

  // Beklenen oran verilmişse (A4/kimlik gibi), oran eşleşmesi zaten
  // güvenilirlik sağlıyor demektir — bu durumda küçük ama doğru oranlı
  // bir bölgeyi (örn. zoom yapmadan uzaktan çekilmiş bir kimlik kartı)
  // salt "yeterince büyük değil" diye elemek yanlış olur. Oran verilmemişse
  // (serbest mod) tek sinyal alan büyüklüğü olduğu için daha katı kalınır.
  const minComponentFraction = expectedAspect !== undefined ? (mode === "live" ? 0.035 : 0.045) : mode === "live" ? 0.1 : 0.15;
  let bestCandidate: { rect: RectCandidate; score: number; hullSize: number } | null = null;

  for (const comp of components) {
    if (comp.size < n * minComponentFraction) continue;

    const boundary = extractBoundaryPoints(label, comp.id, w, h);
    if (boundary.length < 8) continue;

    const hull = convexHull(boundary);
    if (hull.length < 3) continue;

    const rect = minAreaRect(hull);
    if (!rect) continue;

    const s = scoreCandidate(rect, n, expectedAspect, minComponentFraction);
    if (s < 0) continue;

    if (!bestCandidate || s > bestCandidate.score) {
      bestCandidate = { rect, score: s, hullSize: hull.length };
    }
  }

  if (!bestCandidate) {
    return {
      corners: null,
      debug: `${components.length} aday incelendi, uygun boyut/oranda hiçbiri bulunamadı.`,
    };
  }

  const ordered = orderCorners(bestCandidate.rect.corners);

  // Kenar oturtma sadece "capture" modunda — canlı önizlemede her karede
  // çalıştırmak gereksiz maliyet (zaten hızlı, kaba tahmin yeterli).
  // Çekim sonrası tek seferlik burada zaman bütçemiz bol.
  const finalCorners = mode === "capture" ? refineCorners(score, w, h, ordered, threshold) : ordered;

  const areaRatio = bestCandidate.rect.area / n;
  const actualAspect = bestCandidate.rect.width / bestCandidate.rect.height;
  const debug = `Başarılı: ${components.length} aday arasından seçildi, alan oranı %${(areaRatio * 100).toFixed(
    1
  )}, oran=${actualAspect.toFixed(2)}${expectedAspect ? ` (beklenen ${expectedAspect.toFixed(2)})` : ""}, eşik=${threshold} (Otsu)${
    mode === "capture" ? ", kenar oturtma uygulandı" : ""
  }.`;

  return { corners: finalCorners, debug };
}

self.onmessage = (e: MessageEvent<RequestMsg>) => {
  const { id, imageData, mode, expectedAspect } = e.data;
  try {
    const result = detect(imageData, mode ?? "capture", expectedAspect);
    (self as unknown as Worker).postMessage({ id, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    (self as unknown as Worker).postMessage({ id, corners: null, debug: `Beklenmeyen hata: ${msg}` });
  }
};
