import { useEffect, useRef } from "react";

const REFRESH_DEBOUNCE_MS = 75;

export function useIncidentEvents(onIncidentChange: () => void) {
  const callbackRef = useRef(onIncidentChange);

  useEffect(() => {
    callbackRef.current = onIncidentChange;
  }, [onIncidentChange]);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;

    const eventSource = new EventSource("/api/disaster/events");
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const handleIncidentChange = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        callbackRef.current();
      }, REFRESH_DEBOUNCE_MS);
    };

    eventSource.addEventListener("incident", handleIncidentChange);
    eventSource.addEventListener("ready", handleIncidentChange);

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      eventSource.removeEventListener("incident", handleIncidentChange);
      eventSource.removeEventListener("ready", handleIncidentChange);
      eventSource.close();
    };
  }, []);
}
