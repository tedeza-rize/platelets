export type IncidentChange = {
  incidentId: string;
  mutation: "created" | "deleted" | "updated";
  occurredAt: string;
  version: number;
};

type IncidentChangeInput = Pick<IncidentChange, "incidentId" | "mutation">;
type IncidentChangeListener = (change: IncidentChange) => void;

type IncidentChangeHub = {
  listeners: Set<IncidentChangeListener>;
  version: number;
};

const globalScope = globalThis as typeof globalThis & {
  __plateletsIncidentChangeHub?: IncidentChangeHub;
};

function getHub() {
  globalScope.__plateletsIncidentChangeHub ??= {
    listeners: new Set(),
    version: 0,
  };

  return globalScope.__plateletsIncidentChangeHub;
}

export function getIncidentChangeVersion() {
  return getHub().version;
}

export function getIncidentChangeSubscriberCount() {
  return getHub().listeners.size;
}

export function publishIncidentChange(input: IncidentChangeInput) {
  const hub = getHub();
  const change: IncidentChange = {
    ...input,
    occurredAt: new Date().toISOString(),
    version: hub.version + 1,
  };
  hub.version = change.version;

  for (const listener of hub.listeners) {
    try {
      listener(change);
    } catch {}
  }

  return change;
}

export function subscribeToIncidentChanges(listener: IncidentChangeListener) {
  const hub = getHub();
  hub.listeners.add(listener);

  return () => {
    hub.listeners.delete(listener);
  };
}
