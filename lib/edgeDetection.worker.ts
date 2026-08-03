/// <reference lib="webworker" />

// Kenar algılamayı burada, ana thread DIŞINDA çalıştırıyoruz ki arayüz
// (geri tuşu, animasyonlar) hiçbir zaman donmasın.
//
// NOT: Önceki sürüm ham Sobel gradyanında "kenardan içeri ilk güçlü
// nokta"yı arıyordu. Bu yöntem, arka plan dokuluysa (masa deseni, gölge,
// ahşap desen) görüntünün kenarına yakın yanlış bir noktada durabiliyor
// ve gerçek kağıt sınırını hiç bulamıyordu.
//
// Bunun yerine "beyaz kağıt" varsayımını doğrudan kullanan, çok daha
// dayanıklı bir yöntem: her pikselin ne kadar "kağıt gibi" (parlak +
// düşük renk doygunluğu, yani beyaz/gri/hafif krem) olduğunu puanlayıp
// bir ikili maske çıkarıyoruz. Sonra bu maskeyi satır/sütun bazında
// TOPLAM kaplama oranına göre projeksiyonluyoruz — tek bir pikselin
// yanlış tetiklemesi yerine, "bu satırın/sütunun çoğu kağıt mı?"
// sorusuna bakıyoruz. Bu, doku/gölge kaynaklı yanlış pozitiflere karşı
// çok daha sağlam.

interface Point {
  x: number;
  y: number;
}

interface RequestMsg {
  id: number;
  imageData: ImageData;
}

function detect(imageData: ImageData): { corners: [Point, Point, Point, Point] | null; debug: string } {
  const { width: w, height: h, data } = imageData;
  const n = w * h;

  // 1) Her piksel için parlaklık ve renk doygunluğu (max-min kanal farkı).
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

  // 2) "Kağıt gibi" eşiği: ortalama parlaklığın biraz altı (kağıt genelde
  // sahnenin en parlak/en nötr yüzeyidir), doygunluk da düşük olmalı.
  const brightnessThreshold = Math.min(235, Math.max(120, avgBrightness * 0.82));
  const saturationThreshold = 60;

  const mask = new Uint8Array(n);
  let paperPixelCount = 0;
  for (let i = 0; i < n; i++) {
    if (brightness[i] >= brightnessThreshold && saturation[i] <= saturationThreshold) {
      mask[i] = 1;
      paperPixelCount++;
    }
  }

  if (paperPixelCount < n * 0.08) {
    const debug = `Yeterince parlak/beyaz bir bölge bulunamadı (kaplama %${((paperPixelCount / n) * 100).toFixed(
      1
    )}). Işık çok az olabilir ya da kağıt arka planla yeterince kontrast oluşturmuyor.`;
    return { corners: null, debug };
  }

  // 3) Satır/sütun projeksiyonu: her satırdaki ve sütundaki "kağıt"
  // piksel sayısını topla.
  const rowSum = new Int32Array(h);
  const colSum = new Int32Array(w);
  for (let y = 0; y < h; y++) {
    let rs = 0;
    const base = y * w;
    for (let x = 0; x < w; x++) {
      if (mask[base + x]) {
        rs++;
        colSum[x]++;
      }
    }
    rowSum[y] = rs;
  }

  // 4) Üst/alt sınır: satırın en az %55'i kağıt olan EN UZUN ardışık satır
  // aralığını bul (küçük gürültü boşluklarına tolerans tanıyarak).
  const rowThreshold = w * 0.55;
  const colThreshold = h * 0.55;

  function longestRun(sums: Int32Array, len: number, threshold: number): [number, number] | null {
    let bestStart = -1;
    let bestEnd = -1;
    let curStart = -1;
    let gap = 0;
    const maxGap = Math.max(2, Math.round(len * 0.02));

    for (let i = 0; i < len; i++) {
      const isAbove = sums[i] >= threshold;
      if (isAbove) {
        if (curStart === -1) curStart = i;
        gap = 0;
      } else if (curStart !== -1) {
        gap++;
        if (gap > maxGap) {
          const end = i - gap;
          if (end - curStart > bestEnd - bestStart) {
            bestStart = curStart;
            bestEnd = end;
          }
          curStart = -1;
          gap = 0;
        }
      }
    }
    if (curStart !== -1) {
      const end = len - 1 - gap;
      if (end - curStart > bestEnd - bestStart) {
        bestStart = curStart;
        bestEnd = end;
      }
    }
    return bestStart === -1 ? null : [bestStart, bestEnd];
  }

  const rowRun = longestRun(rowSum, h, rowThreshold);
  const colRun = longestRun(colSum, w, colThreshold);

  if (!rowRun || !colRun) {
    const debug = `Beyaz bölge bulundu ama net bir dörtgen sınırı çıkarılamadı (satır eşiği: ${rowRun ? "ok" : "başarısız"}, sütun eşiği: ${
      colRun ? "ok" : "başarısız"
    }). Kağıt çerçeveyi tam doldurmuyor olabilir.`;
    return { corners: null, debug };
  }

  const [top, bottom] = rowRun;
  const [left, right] = colRun;

  if (right - left < w * 0.25 || bottom - top < h * 0.25) {
    const debug = `Bulunan bölge çok küçük (${(((right - left) * (bottom - top)) / n * 100).toFixed(
      1
    )}% alan). Belgeyi çerçeveye daha çok yaklaştır.`;
    return { corners: null, debug };
  }

  const ratio = ((right - left) * (bottom - top)) / n;
  const debug = `Başarılı: sol=${left}, sağ=${right}, üst=${top}, alt=${bottom} (alan oranı %${(ratio * 100).toFixed(
    1
  )}, kağıt eşiği=${brightnessThreshold.toFixed(0)}).`;

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
