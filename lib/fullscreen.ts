/**
 * Chrome mobilde adres çubuğu/alt bar'ı gizleyip gerçek tam ekrana
 * geçmenin tek yolu Fullscreen API'dir — position:fixed/100dvh bunu
 * yapmaz, sadece tarayıcı arayüzü ÇIKARILDIKTAN SONRA kalan alanı
 * doldurur. requestFullscreen() SADECE bir kullanıcı jestiyle (click)
 * senkron olarak tetiklenen çağrı zincirinde çalışır — bu yüzden
 * navigasyondan (router.push) ÖNCE, onClick handler'ının en başında
 * çağrılmalı.
 */
export async function enterFullscreen() {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (document.fullscreenElement) return;
  try {
    await el.requestFullscreen();
  } catch {
    // Tarayıcı desteklemiyor ya da kullanıcı jesti sayılmadı — sessizce
    // geç, uygulama normal (fullscreen olmayan) modda çalışmaya devam eder.
  }
}

export async function exitFullscreen() {
  if (typeof document === "undefined") return;
  if (!document.fullscreenElement) return;
  try {
    await document.exitFullscreen();
  } catch {
    // Zaten çıkılmış ya da desteklenmiyor.
  }
}
