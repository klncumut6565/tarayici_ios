"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sessizce geç: offline destek olmadan da uygulama çalışmaya devam eder.
      });
    }
  }, []);

  return null;
}
