import {
  getIncidentChangeSubscriberCount,
  getIncidentChangeVersion,
  type IncidentChange,
  subscribeToIncidentChanges,
} from "@/lib/disaster-response/incident-change-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_INTERVAL_MS = 15_000;
const MAX_SUBSCRIBERS = 200;
const encoder = new TextEncoder();

function encodeEvent(event: string, data: unknown, id?: number) {
  const lines = [
    ...(id === undefined ? [] : [`id: ${id}`]),
    `event: ${event}`,
    `data: ${JSON.stringify(data)}`,
    "",
    "",
  ];

  return encoder.encode(lines.join("\n"));
}

export function GET(request: Request) {
  if (getIncidentChangeSubscriberCount() >= MAX_SUBSCRIBERS) {
    return new Response(null, {
      headers: { "Retry-After": "5" },
      status: 503,
    });
  }

  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let unsubscribe = () => {};
      const handleAbort = () => cleanup();

      cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        if (heartbeat) clearInterval(heartbeat);
        request.signal.removeEventListener("abort", handleAbort);
      };

      const send = (chunk: Uint8Array) => {
        if (closed) return;

        try {
          controller.enqueue(chunk);
        } catch {
          cleanup();
        }
      };
      const sendIncidentChange = (change: IncidentChange) => {
        send(encodeEvent("incident", change, change.version));
      };

      unsubscribe = subscribeToIncidentChanges(sendIncidentChange);
      send(
        encodeEvent("ready", {
          connectedAt: new Date().toISOString(),
          version: getIncidentChangeVersion(),
        }),
      );
      heartbeat = setInterval(() => {
        send(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
      }, HEARTBEAT_INTERVAL_MS);
      request.signal.addEventListener("abort", handleAbort, { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
