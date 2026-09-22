"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "tarayici:install-prompt-dismissed";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

/**
 * iOS'taki HİÇBİR tarayıcı (Safari, Chrome, Arc — hepsi WebKit zorunlu)
 * Fullscreen API'yi desteklemiyor; adres çubuğunu/alt barı kaldırmanın
 * tek yolu uygulamayı Ana Ekrana Ekleyip oradan açmak (manifest'te
 * "display": "standalone" zaten tanımlı). Bu banner sadece iOS'ta,
 * tarayıcı sekmesinde (henüz ana ekrandan açılmamışken) gösterilir.
 */
export default function InstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isIOS() && !isStandalone() && !localStorage.getItem(DISMISS_KEY)) {
      setShow(true);
    }
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }

  if (!show) return null;

  return (
    <div
      style={{
        position: "relative",
        marginBottom: 16,
        padding: "12px 14px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--line)",
        background: "rgba(255,143,0,0.08)",
        fontSize: 13,
        lineHeight: 1.5,
        color: "var(--ink)",
      }}
    >
      <button
        onClick={dismiss}
        aria-label="Kapat"
        style={{ position: "absolute", top: 8, right: 10, color: "var(--ink-dim)", fontSize: 16 }}
      >
        ×
      </button>
      <strong>Tam ekran kamera için:</strong> Paylaş <span aria-hidden>􀈂</span> menüsünden{" "}
      <strong>Ana Ekrana Ekle</strong>'yi seç ve uygulamayı oradan aç. iOS'ta tarayıcı
      sekmesi içinden adres çubuğu hiçbir zaman gizlenemiyor — bu Apple kısıtlaması,
      uygulamanın kendisinden kaynaklanmıyor.
    </div>
  );
}
