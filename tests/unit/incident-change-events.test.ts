import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "@/app/api/disaster/events/route";
import {
  getIncidentChangeVersion,
  publishIncidentChange,
  subscribeToIncidentChanges,
} from "@/lib/disaster-response/incident-change-events";

test("incident change subscribers receive bounded mutation metadata", () => {
  const changes: Array<{ incidentId: string; mutation: string }> = [];
  const unsubscribe = subscribeToIncidentChanges((change) => {
    changes.push({
      incidentId: change.incidentId,
      mutation: change.mutation,
    });
  });

  publishIncidentChange({ incidentId: "inc-test", mutation: "updated" });
  unsubscribe();
  publishIncidentChange({ incidentId: "inc-ignored", mutation: "deleted" });

  assert.deepEqual(changes, [{ incidentId: "inc-test", mutation: "updated" }]);
});

test("one incident change subscriber cannot break other listeners", () => {
  let received = false;
  const unsubscribeFailure = subscribeToIncidentChanges(() => {
    throw new Error("listener failure");
  });
  const unsubscribeSuccess = subscribeToIncidentChanges(() => {
    received = true;
  });

  assert.doesNotThrow(() => {
    publishIncidentChange({ incidentId: "inc-safe", mutation: "updated" });
  });
  assert.equal(received, true);
  unsubscribeFailure();
  unsubscribeSuccess();
});

test("disaster event route streams ready and incident SSE events", async () => {
  const abortController = new AbortController();
  const response = GET(
    new Request("http://localhost/api/disaster/events", {
      signal: abortController.signal,
    }),
  );
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  assert.equal(
    response.headers.get("content-type"),
    "text/event-stream; charset=utf-8",
  );
  assert.ok(reader);

  const readyChunk = await reader.read();
  const readyText = decoder.decode(readyChunk.value);
  assert.match(readyText, /event: ready/);
  assert.match(
    readyText,
    new RegExp(`"version":${getIncidentChangeVersion()}`),
  );

  const change = publishIncidentChange({
    incidentId: "inc-stream-test",
    mutation: "created",
  });
  const incidentChunk = await reader.read();
  const incidentText = decoder.decode(incidentChunk.value);
  assert.match(incidentText, new RegExp(`id: ${change.version}`));
  assert.match(incidentText, /event: incident/);
  assert.match(incidentText, /"incidentId":"inc-stream-test"/);

  abortController.abort();
  await reader.cancel();
});
