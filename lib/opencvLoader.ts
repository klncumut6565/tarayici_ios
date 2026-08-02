// OpenCV.js'i ihtiyaç anında (kırpma ekranı açıldığında) yükler ve
// tekil bir promise ile cache'ler. Kütüphane ~8MB olduğu için build'e
// dahil etmek yerine CDN'den lazy-load ediyoruz; sadece kenar algılama
// gerektiğinde indirilir, uygulama açılışını yavaşlatmaz.
//
// NOT: npm paketi (@techstark/opencv-js) bundler/ESM kullanımı için
// tasarlanmış; düz <script> etiketiyle yüklendiğinde bazı ortamlarda
// window.cv'yi hiç set etmeden sessizce çalışmayabiliyor (hata da
// vermiyor, sonsuza dek "yükleniyor" gibi kalıyor). Bunun yerine
// OpenCV'nin resmi <script> kullanımı için belgelediği derlemeyi
// kullanıyoruz: https://docs.opencv.org/4.x/opencv.js
const OPENCV_SRC = "https://docs.opencv.org/4.x/opencv.js";
const LOAD_TIMEOUT_MS = 15000;

let loadingPromise: Promise<any> | null = null;

export function loadOpenCV(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenCV yalnızca tarayıcıda yüklenebilir"));
  }

  const w = window as any;
  if (w.cv && w.cv.Mat) return Promise.resolve(w.cv);
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      loadingPromise = null;
      reject(
        new Error(
          `OpenCV zaman aşımına uğradı (${LOAD_TIMEOUT_MS / 1000} sn içinde hazır olmadı). ` +
            `Muhtemel sebep: ağ engeli, adblocker veya CSP kısıtlaması (kaynak: ${OPENCV_SRC}).`
        )
      );
    }, LOAD_TIMEOUT_MS);

    function settleResolve(cv: any) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(cv);
    }

    function settleReject(message: string) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      loadingPromise = null;
      reject(new Error(message));
    }

    const finish = () => {
      const cv = w.cv;
      if (!cv) {
        settleReject("Script yüklendi ama window.cv tanımlanmadı (opencv.js beklenmedik biçimde çalıştı).");
        return;
      }
      if (cv.Mat) {
        settleResolve(cv);
      } else {
        cv["onRuntimeInitialized"] = () => settleResolve(cv);
      }
    };

    const existing = document.getElementById("opencv-js") as HTMLScriptElement | null;
    if (existing) {
      if (w.cv) finish();
      else existing.addEventListener("load", finish);
      existing.addEventListener("error", () => settleReject(`OpenCV script dosyası indirilemedi: ${OPENCV_SRC}`));
      return;
    }

    const script = document.createElement("script");
    script.id = "opencv-js";
    script.src = OPENCV_SRC;
    script.async = true;
    script.onload = finish;
    script.onerror = () => settleReject(`OpenCV script dosyası indirilemedi: ${OPENCV_SRC}`);
    document.body.appendChild(script);
  });

  return loadingPromise;
}
