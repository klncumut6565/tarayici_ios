/// <reference lib="webworker" />

// Kenar algılamayı burada, ana thread DIŞINDA çalıştırıyoruz ki arayüz
// (geri tuşu, animasyonlar) hiçbir zaman donmasın.
//
// NOT: Bu worker daha önce OpenCV.js (WASM, ~8-10MB) kullanıyordu. Worker
// içine taşımak UI donmasını (ana thread bloklanması) çözdü, ama asıl
// sorunu çözmedi: OpenCV'nin kendisi bazı cihazlarda/ortamlarda hâlâ
// yüklenemiyor ya da başlatılamıyor, bu da hem "algılama zaman aşımına
// uğradı" hem de CPU/RAM'in yüksek kalması demekti (worker içinde de
// olsa o ağır WASM kütüphanesi hâlâ indirilip derlenmeye çalışılıyordu).
//
// Bunun yerine, hiçbir dış kütüphane/WASM gerektirmeyen, saf JavaScript
// bir yöntem kullanıyoruz: Sobel gradyan büyüklüğü + kenarlardan içeri
// çoklu-çizgi taraması (medyan ile gürültüye dayanıklı). Anında çalışır,
// hafif eğik fotoğraflarda mükemmel köşe bulamayabilir ama her zaman
// makul bir başlangıç dikdörtgeni verir; kullanıcı köşeleri büyüteçle
// saniyeler içinde düzeltebilir.

interface Point {
  x: number;
  y: number;
}

interface RequestMsg {
  id: number;
  imageData: ImageData;
}

function median(vals: number[]): number | null {
  if (vals.length === 0) return null;
  const s = [...vals].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function detect(imageData: ImageData): { corners: [Point, Point, Point, Point] | null; debug: string } {
  const { width: w, height: h, data } = imageData;

  // Gri tonlama
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }

  // Sobel gradyan büyüklüğü (3x3 kernel, kenarlar hariç)
  const grad = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] + gray[i - w + 1] - 2 * gray[i - 1] + 2 * gray[i + 1] - gray[i + w - 1] + gray[i + w + 1];
      const gy =
        -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] + gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      grad[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  // Eşik: histogramın yaklaşık %85. yüzdelik dilimi (örneklenerek, hızlı).
  const sampleStep = Math.max(1, Math.floor((w * h) / 20000));
  const sample: number[] = [];
  for (let i = 0; i < grad.length; i += sampleStep) if (grad[i] > 0) sample.push(grad[i]);
  sample.sort((a, b) => a - b);
  const threshold = sample.length > 0 ? sample[Math.floor(sample.length * 0.85)] : 40;
  const minThreshold = Math.max(threshold, 24);

  const marginX = Math.round(w * 0.03);
  const marginY = Math.round(h * 0.03);

  // Sol/sağ kenar: dikey orta %60'lık bandda birkaç satır boyunca tara.
  const rows: number[] = [];
  for (let k = 0; k < 9; k++) rows.push(Math.round(h * (0.2 + (k / 8) * 0.6)));
  const leftHits: number[] = [];
  const rightHits: number[] = [];
  for (const y of rows) {
    for (let x = marginX; x < w - marginX; x++) {
      if (grad[y * w + x] > minThreshold) {
        leftHits.push(x);
        break;
      }
    }
    for (let x = w - marginX - 1; x >= marginX; x--) {
      if (grad[y * w + x] > minThreshold) {
        rightHits.push(x);
        break;
      }
    }
  }

  // Üst/alt kenar: yatay orta %60'lık bandda birkaç sütun boyunca tara.
  const cols: number[] = [];
  for (let k = 0; k < 9; k++) cols.push(Math.round(w * (0.2 + (k / 8) * 0.6)));
  const topHits: number[] = [];
  const bottomHits: number[] = [];
  for (const x of cols) {
    for (let y = marginY; y < h - marginY; y++) {
      if (grad[y * w + x] > minThreshold) {
        topHits.push(y);
        break;
      }
    }
    for (let y = h - marginY - 1; y >= marginY; y--) {
      if (grad[y * w + x] > minThreshold) {
        bottomHits.push(y);
        break;
      }
    }
  }

  const left = median(leftHits);
  const right = median(rightHits);
  const top = median(topHits);
  const bottom = median(bottomHits);

  if (left === null || right === null || top === null || bottom === null || right - left < w * 0.2 || bottom - top < h * 0.2) {
    const debug = `Kenar taraması yeterli sinyal bulamadı (sol=${left ?? "-"}, sağ=${right ?? "-"}, üst=${top ?? "-"}, alt=${bottom ?? "-"}). Belge ile arka plan arasındaki kontrast düşük olabilir.`;
    return { corners: null, debug };
  }

  const ratio = ((right - left) * (bottom - top)) / (w * h);
  const debug = `Başarılı: sol=${left}, sağ=${right}, üst=${top}, alt=${bottom} (alan oranı %${(ratio * 100).toFixed(1)}).`;

  return {
    corners: [
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom },
    ],
    debug,
  };
}

self.onmessage = (e: MessageEvent<RequestMsg>) => {
  const { id, imageData } = e.data;
  try {
    const { corners, debug } = detect(imageData);
    (self as unknown as Worker).postMessage({ id, corners, debug });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    (self as unknown as Worker).postMessage({ id, corners: null, debug: `Beklenmeyen hata: ${msg}` });
  }
};
