"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sessizce geç: offline destek olmadan da uygulama çalışmaya devam eder.
      });
    }

    // Kalıcı depolama iste: bunu almadan iOS Safari, tarayıcı çok sayfalı
    // belge biriktirdiğinde depolamayı beklenenden erken (diğer sekme/site
    // baskısı altında) boşaltabiliyor ve bu da "kayıt hatası"na yol açıyordu.
    if (navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {});
    }
  }, []);

  return null;
}
