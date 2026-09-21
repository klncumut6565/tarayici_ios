/**
 * Bazı Android/iOS Chrome kombinasyonlarında getUserMedia "ideal"
 * width/height kısıtlarını yok sayıp kameranın kendi varsayılan (çoğu
 * zaman yatay/kareye yakın) modunu döndürüyor — Safari'de sorun
 * olmuyor. Otomatik algılamayla uğraşmak yerine kullanıcının çözünürlüğü
 * Ayarlar'dan MANUEL seçebilmesini sağlıyoruz; seçim localStorage'da
 * tutulur ve bir sonraki kamera açılışında (bu oturumdan itibaren)
 * uygulanır.
 */

export interface CameraPreset {
  id: string;
  label: string;
  sublabel: string;
  width: number;
  height: number;
}

export const CAMERA_PRESETS: CameraPreset[] = [
  { id: "auto", label: "Otomatik", sublabel: "Tarayıcının varsayılanı", width: 1920, height: 2560 },
  { id: "hd", label: "Dikey HD", sublabel: "720 × 1280", width: 720, height: 1280 },
  { id: "fullhd", label: "Dikey Full HD", sublabel: "1080 × 1920", width: 1080, height: 1920 },
  { id: "qhd", label: "Dikey 2K", sublabel: "1440 × 2560", width: 1440, height: 2560 },
  { id: "a4", label: "A4 Oranı", sublabel: "1240 × 1754 — kağıt oranına en yakın", width: 1240, height: 1754 },
];

const STORAGE_KEY = "tarayici:camera-preset";
const DEFAULT_PRESET_ID = "auto";

export function getCameraPresetId(): string {
  if (typeof window === "undefined") return DEFAULT_PRESET_ID;
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_PRESET_ID;
  } catch {
    return DEFAULT_PRESET_ID;
  }
}

export function setCameraPresetId(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // localStorage kapalı/dolu olabilir — sessizce geç, bir sonraki
    // kamera açılışı yine de "auto" ile çalışmaya devam eder.
  }
}

export function getCameraPreset(): CameraPreset {
  const id = getCameraPresetId();
  return CAMERA_PRESETS.find((p) => p.id === id) ?? CAMERA_PRESETS[0];
}
