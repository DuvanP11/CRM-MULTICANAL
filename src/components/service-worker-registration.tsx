"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    // Registrar solo en producción o localhost (para probar instalable en local)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("Service worker registrado:", reg.scope);
        })
        .catch((err) => {
          console.warn("Service worker no registrado:", err);
        });
    }
  }, []);

  return null;
}