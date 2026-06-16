import { haversineMeters } from "@/lib/emergency-routing";

const RECOMMENDATION_TIMEOUT_MS = 8_000;

export async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) {
  const output = new Array<R>(values.length);
  let index = 0;

  async function worker() {
    while (index < values.length) {
      const current = index;
      index += 1;
      output[current] = await mapper(values[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, worker),
  );
  return output;
}

export function estimatedEta<
  T extends { distanceMeters: number; latitude: number; longitude: number },
>(candidate: T, origin: { latitude: number; longitude: number }) {
  const roadDistance = Math.max(
    candidate.distanceMeters * 1.25,
    haversineMeters(origin, candidate),
  );

  return {
    candidate,
    distanceMeters: Math.round(roadDistance),
    durationSeconds: Math.round(roadDistance / 11.1),
    etaSource: "estimated" as const,
  };
}

export async function withRecommendationTimeout<T>(promise: Promise<T>) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error("recommendation_timeout")),
      RECOMMENDATION_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
