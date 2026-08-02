// OpenCV.js'i ihtiyaç anında (kırpma ekranı açıldığında) yükler ve
// tekil bir promise ile cache'ler. Kütüphane ~8MB olduğu için build'e
// dahil etmek yerine CDN'den lazy-load ediyoruz; sadece kenar algılama
// gerektiğinde indirilir, uygulama açılışını yavaşlatmaz.
const OPENCV_SRC = "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.9.0-release.1/dist/opencv.js";

let loadingPromise: Promise<any> | null = null;

export function loadOpenCV(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenCV yalnızca tarayıcıda yüklenebilir"));
  }

  const w = window as any;
  if (w.cv && w.cv.Mat) return Promise.resolve(w.cv);
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const finish = () => {
      const cv = w.cv;
      if (!cv) {
        reject(new Error("OpenCV yüklenemedi"));
        return;
      }
      if (cv.Mat) {
        resolve(cv);
      } else {
        cv.onRuntimeInitialized = () => resolve(cv);
      }
    };

    const existing = document.getElementById("opencv-js") as HTMLScriptElement | null;
    if (existing) {
      if (w.cv) finish();
      else existing.addEventListener("load", finish);
      existing.addEventListener("error", () => reject(new Error("OpenCV yüklenemedi")));
      return;
    }

    const script = document.createElement("script");
    script.id = "opencv-js";
    script.src = OPENCV_SRC;
    script.async = true;
    script.onload = finish;
    script.onerror = () => {
      loadingPromise = null;
      reject(new Error("OpenCV yüklenemedi"));
    };
    document.body.appendChild(script);
  });

  return loadingPromise;
}
