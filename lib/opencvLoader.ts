// OpenCV.js'i ihtiyaç anında (kırpma ekranı açıldığında) yükler ve
// tekil bir promise ile cache'ler.
//
// NOT: Önceki sürüm docs.opencv.org'dan bir <script> etiketiyle yüklüyordu.
// Bu, gerçek cihazlarda sessizce başarısız oluyordu (ağ/CDN engeli, CSP,
// adblocker ya da opencv.js'in bazı build'lerinin script-tag ortamında
// window.cv'yi hiç set etmemesi gibi sebeplerle) — algılama hiç
// çalışmıyor, uygulama sabit çerçeveye geri düşüyordu.
//
// Bunun yerine paketi (@techstark/opencv-js) normal bir ES modülü olarak
// import ediyoruz. Next.js bunu build sırasında ayrı, tembel yüklenen bir
// chunk olarak paketler (~10MB, sadece bu ekran açıldığında indirilir);
// aynı origin'den geldiği için service worker tarafından cache'lenebilir
// ve harici bir CDN'e/CORS'a bağımlılık kalmaz.
const LOAD_TIMEOUT_MS = 20000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loadingPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadOpenCV(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenCV yalnızca tarayıcıda yüklenebilir"));
  }
  if (loadingPromise) return loadingPromise;

  loadingPromise = import("@techstark/opencv-js")
    .then(
      (mod) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new Promise<any>((resolve, reject) => {
          const cv = (mod as { default?: unknown }).default ?? mod;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cvAny = cv as any;

          const timeoutId = setTimeout(() => {
            reject(
              new Error(
                `OpenCV zaman aşımına uğradı (${LOAD_TIMEOUT_MS / 1000} sn içinde hazır olmadı). WASM modülü indirilip başlatılamadı.`
              )
            );
          }, LOAD_TIMEOUT_MS);

          if (cvAny.Mat) {
            clearTimeout(timeoutId);
            resolve(cvAny);
            return;
          }

          cvAny.onRuntimeInitialized = () => {
            clearTimeout(timeoutId);
            resolve(cvAny);
          };
        })
    )
    .catch((err) => {
      loadingPromise = null;
      throw err instanceof Error ? err : new Error(`OpenCV yüklenemedi: ${String(err)}`);
    });

  return loadingPromise;
}
