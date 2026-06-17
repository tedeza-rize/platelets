"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    function reportNetworkStatus() {
      navigator.serviceWorker.controller?.postMessage({
        online: navigator.onLine,
        type: "network-status",
      });
    }

    async function registerServiceWorker() {
      const registration = await navigator.serviceWorker.register(
        "/sw.js?v=4",
        {
          scope: "/",
          updateViaCache: "none",
        },
      );
      await navigator.serviceWorker.ready;
      registration.active?.postMessage({
        online: navigator.onLine,
        type: "network-status",
      });
    }

    window.addEventListener("offline", reportNetworkStatus);
    window.addEventListener("online", reportNetworkStatus);
    registerServiceWorker().catch(() => undefined);
    return () => {
      window.removeEventListener("offline", reportNetworkStatus);
      window.removeEventListener("online", reportNetworkStatus);
    };
  }, []);

  return null;
}
