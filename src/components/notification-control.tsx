"use client";

import { Bell, BellOff, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppDictionary } from "@/lib/i18n";
import { uiText } from "@/lib/i18n";
import styles from "./notification-control.module.css";

type NotificationState =
  | "blocked"
  | "disabled"
  | "enabled"
  | "failed"
  | "loading"
  | "unsupported";

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (character) =>
    character.charCodeAt(0),
  );
}

async function deleteServerSubscription(endpoint: string) {
  await fetch("/api/notifications/subscriptions", {
    body: JSON.stringify({ endpoint }),
    headers: { "Content-Type": "application/json" },
    method: "DELETE",
  });
}

export function NotificationControl({
  dictionary,
}: {
  dictionary: AppDictionary;
}) {
  const [publicKey, setPublicKey] = useState("");
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [state, setState] = useState<NotificationState>("disabled");
  const t = (key: string) => uiText(dictionary, key);

  useEffect(() => {
    let disposed = false;

    async function initialize() {
      const response = await fetch("/api/notifications/config", {
        cache: "no-store",
      });
      const config = (await response.json().catch(() => null)) as {
        enabled?: boolean;
        publicKey?: string;
      } | null;
      if (!response.ok || !config?.enabled || !config.publicKey || disposed) {
        return;
      }

      setPublicKey(config.publicKey);
      if (!("serviceWorker" in navigator)) {
        setState("unsupported");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      if (!("Notification" in window) || !("PushManager" in window)) {
        setState("unsupported");
        return;
      }

      const existing = await registration.pushManager.getSubscription();
      if (disposed) return;

      setSubscription(existing);
      setState(
        Notification.permission === "denied"
          ? "blocked"
          : existing
            ? "enabled"
            : "disabled",
      );
    }

    initialize().catch(() => {
      if (!disposed) setState("failed");
    });

    return () => {
      disposed = true;
    };
  }, []);

  if (!publicKey) return null;

  async function toggleNotifications() {
    setState("loading");

    try {
      if (subscription) {
        await deleteServerSubscription(subscription.endpoint);
        await subscription.unsubscribe();
        setSubscription(null);
        setState("disabled");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("blocked");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const nextSubscription = await registration.pushManager.subscribe({
        applicationServerKey: applicationServerKey(publicKey),
        userVisibleOnly: true,
      });
      const response = await fetch("/api/notifications/subscriptions", {
        body: JSON.stringify({
          locale: document.documentElement.lang === "en" ? "en" : "ko",
          subscription: nextSubscription.toJSON(),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        await nextSubscription.unsubscribe();
        throw new Error("subscription-save-failed");
      }

      setSubscription(nextSubscription);
      setState("enabled");
    } catch {
      setState("failed");
    }
  }

  const label =
    state === "enabled"
      ? t("notification.control.disable")
      : state === "loading"
        ? t("notification.control.loading")
        : state === "blocked"
          ? t("notification.control.blocked")
          : state === "unsupported"
            ? t("notification.control.unsupported")
            : state === "failed"
              ? t("notification.control.failed")
              : t("notification.control.enable");

  return (
    <button
      aria-pressed={state === "enabled"}
      className={styles.control}
      data-testid="notification-control"
      disabled={
        state === "blocked" || state === "loading" || state === "unsupported"
      }
      onClick={toggleNotifications}
      title={label}
      type="button"
    >
      {state === "loading" ? (
        <LoaderCircle aria-hidden="true" className={styles.spinner} size={17} />
      ) : state === "enabled" ? (
        <BellOff aria-hidden="true" size={17} />
      ) : (
        <Bell aria-hidden="true" size={17} />
      )}
      <span>{label}</span>
    </button>
  );
}
