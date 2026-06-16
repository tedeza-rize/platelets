type CachedValue<T> = {
  expiresAt: number;
  value: T;
};

type CacheOptions = {
  maxEntries: number;
  now?: () => number;
  ttlMs: number;
};

const GRAPH_CACHE_OPTIONS = {
  maxEntries: 12,
  ttlMs: 10 * 60 * 1000,
} as const;
const ROUTE_CACHE_OPTIONS = {
  maxEntries: 100,
  ttlMs: 60 * 1000,
} as const;

const graphCache = new Map<string, CachedValue<unknown>>();
const graphInflight = new Map<string, Promise<unknown>>();
const routeCache = new Map<string, CachedValue<unknown>>();
const routeInflight = new Map<string, Promise<unknown>>();

function getFreshValue<T>(
  cache: Map<string, CachedValue<unknown>>,
  key: string,
  now: number,
) {
  const cached = cache.get(key) as CachedValue<T> | undefined;

  if (!cached) return null;
  if (cached.expiresAt <= now) {
    cache.delete(key);
    return null;
  }

  cache.delete(key);
  cache.set(key, cached);
  return cached.value;
}

function pruneCache(
  cache: Map<string, CachedValue<unknown>>,
  options: CacheOptions,
) {
  const now = options.now?.() ?? Date.now();

  for (const [key, cached] of cache) {
    if (cached.expiresAt <= now) {
      cache.delete(key);
    }
  }

  while (cache.size > options.maxEntries) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}

async function getOrLoadCached<T>(
  cache: Map<string, CachedValue<unknown>>,
  inflight: Map<string, Promise<unknown>>,
  key: string,
  load: () => Promise<T>,
  options: CacheOptions,
) {
  const now = options.now?.() ?? Date.now();
  const cached = getFreshValue<T>(cache, key, now);

  if (cached) return cached;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = load().then((value) => {
    cache.set(key, { expiresAt: now + options.ttlMs, value });
    pruneCache(cache, options);
    return value;
  });
  inflight.set(key, promise);

  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

export function getOrLoadRoadGraph<T>(key: string, load: () => Promise<T>) {
  return getOrLoadCached(graphCache, graphInflight, key, load, {
    ...GRAPH_CACHE_OPTIONS,
  });
}

export function getOrLoadRoute<T>(key: string, load: () => Promise<T>) {
  return getOrLoadCached(routeCache, routeInflight, key, load, {
    ...ROUTE_CACHE_OPTIONS,
  });
}

export function roundedCoordinateKey(coordinate: {
  latitude: number;
  longitude: number;
}) {
  return `${coordinate.latitude.toFixed(5)},${coordinate.longitude.toFixed(5)}`;
}

export function routingCacheStats() {
  return {
    graphEntries: graphCache.size,
    graphInflight: graphInflight.size,
    routeEntries: routeCache.size,
    routeInflight: routeInflight.size,
  };
}

export function clearEmergencyRoutingCachesForTests() {
  graphCache.clear();
  graphInflight.clear();
  routeCache.clear();
  routeInflight.clear();
}
