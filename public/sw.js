const SHELL_CACHE = "platelets-shell-v4";
const RUNTIME_CACHE = "platelets-runtime-v4";
const NETWORK_STATUS_KEY = "/__platelets-network-status";
const PRECACHE_URLS = ["/offline", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("message", (event) => {
  if (event.data?.type === "network-status") {
    event.waitUntil(
      caches
        .open(SHELL_CACHE)
        .then((cache) =>
          cache.put(
            NETWORK_STATUS_KEY,
            new Response(event.data.online === false ? "offline" : "online"),
          ),
        ),
    );
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.all(PRECACHE_URLS.map((url) => safeCache(cache, url))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![SHELL_CACHE, RUNTIME_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (shouldRuntimeCache(request, url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  if (!(payload?.title && payload?.body)) return;

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: payload.data,
      tag: payload.tag,
    }),
  );
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);

  try {
    const response = await fetch(request);
    if (!response.ok) {
      if ((await clientReportedOffline(cache)) || !self.navigator.onLine) {
        return (await cache.match("/offline")) || response;
      }

      return response;
    }

    await cache.put(request, response.clone());
    return response;
  } catch {
    return (
      (await cache.match(request)) ||
      (await cache.match("/offline")) ||
      Response.error()
    );
  }
}

async function clientReportedOffline(cache) {
  const response = await cache.match(NETWORK_STATUS_KEY);
  return response ? (await response.text()) === "offline" : false;
}

async function safeCache(cache, url) {
  try {
    const response = await fetch(url, { cache: "reload" });

    if (response.ok) {
      await cache.put(url, response);
    }
  } catch {
    // Optional shell caching should never block service worker activation.
  }
}

function shouldRuntimeCache(request, url) {
  if (url.origin === self.location.origin) {
    return (
      url.pathname.startsWith("/_next/static/") ||
      url.pathname === "/icon.svg" ||
      request.destination === "font" ||
      request.destination === "image" ||
      request.destination === "script" ||
      request.destination === "style"
    );
  }

  return request.destination === "image" || request.destination === "font";
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then(async (response) => {
      if (response.ok || response.type === "opaque") {
        await cache.put(request, response.clone());
        await trimRuntimeCache(cache, 180);
      }
      return response;
    })
    .catch(() => cached);

  return cached || fresh || Response.error();
}

async function trimRuntimeCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;

  await Promise.all(
    keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)),
  );
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/incidents";

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window" });
      const existing = clients.find((windowClient) => "focus" in windowClient);
      const focusedClient = existing
        ? await existing.navigate(targetUrl)
        : await self.clients.openWindow(targetUrl);
      await focusedClient?.focus();
    })(),
  );
});
