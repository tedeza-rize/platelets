"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    function postNetworkStatus(target: ServiceWorker | null | undefined) {
      target?.postMessage({
        online: navigator.onLine,
        type: "network-status",
      });
    }

    function reportNetworkStatus() {
      postNetworkStatus(navigator.serviceWorker.controller);
      navigator.serviceWorker.ready
        .then((registration) => {
          postNetworkStatus(registration.active);
        })
        .catch(() => undefined);
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
      postNetworkStatus(registration.active);
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
