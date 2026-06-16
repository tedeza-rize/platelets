import {
  getIncidentChangeSubscriberCount,
  getIncidentChangeVersion,
  type IncidentChange,
  type IncidentChangeCursor,
  listIncidentChangesAfterCursor,
  subscribeToIncidentChanges,
} from "@/lib/disaster-response/incident-change-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_INTERVAL_MS = 15_000;
const SHARED_EVENT_POLL_INTERVAL_MS = 2_000;
const MAX_SUBSCRIBERS = 200;
const RECENT_LOCAL_EVENT_TTL_MS = 5_000;
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

  let cleanup = () => {
    // Assigned when the stream starts.
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let sharedEventPoll: ReturnType<typeof setInterval> | null = null;
      let sharedCursor: IncidentChangeCursor | null = null;
      let streamVersion = getIncidentChangeVersion();
      let isPollingSharedEvents = false;
      let unsubscribe = () => {
        // Assigned after subscribing to incident changes.
      };
      const recentLocalEvents = new Map<string, number>();
      const handleAbort = () => cleanup();

      cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        if (heartbeat) clearInterval(heartbeat);
        if (sharedEventPoll) clearInterval(sharedEventPoll);
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
        streamVersion = Math.max(streamVersion, change.version);
        send(encodeEvent("incident", change, change.version));
        recentLocalEvents.set(
          `${change.incidentId}:${change.mutation}`,
          Date.now() + RECENT_LOCAL_EVENT_TTL_MS,
        );
      };
      const sendSharedIncidentChange = (change: IncidentChange) => {
        const now = Date.now();

        for (const [key, expiresAt] of recentLocalEvents) {
          if (expiresAt <= now) {
            recentLocalEvents.delete(key);
          }
        }

        if (
          recentLocalEvents.has(`${change.incidentId}:${change.mutation}`) &&
          Date.parse(change.occurredAt) <= now
        ) {
          return;
        }

        streamVersion += 1;
        send(
          encodeEvent(
            "incident",
            {
              ...change,
              version: streamVersion,
            },
            streamVersion,
          ),
        );
      };
      const pollSharedEvents = async () => {
        if (closed || isPollingSharedEvents) {
          return;
        }

        isPollingSharedEvents = true;

        try {
          const result = await listIncidentChangesAfterCursor(sharedCursor);
          sharedCursor = result.cursor;

          for (const change of result.changes) {
            sendSharedIncidentChange(change);
          }
        } catch {
          send(
            encoder.encode(`: shared event poll unavailable ${Date.now()}\n\n`),
          );
        } finally {
          isPollingSharedEvents = false;
        }
      };

      unsubscribe = subscribeToIncidentChanges(sendIncidentChange);
      void pollSharedEvents();
      sharedEventPoll = setInterval(() => {
        void pollSharedEvents();
      }, SHARED_EVENT_POLL_INTERVAL_MS);
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
