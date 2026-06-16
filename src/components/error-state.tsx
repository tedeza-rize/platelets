"use client";

import { Home, RefreshCw } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useId } from "react";
import { type AppDictionary, uiText } from "@/lib/i18n";
import styles from "./error-state.module.css";
import { offlineImageB64 } from "./offline-image-b64";

export type ErrorKind =
  | "badRequest"
  | "conflict"
  | "dataUnavailable"
  | "forbidden"
  | "gatewayTimeout"
  | "maintenance"
  | "mapLoad"
  | "notFound"
  | "offline"
  | "rateLimited"
  | "routeFailed"
  | "server"
  | "serviceUnavailable"
  | "sessionExpired"
  | "timeSync"
  | "trainingRoom"
  | "unauthorized";

const ERROR_IMAGES: Record<ErrorKind, string> = {
  badRequest: "/error-illustrations/not-found.png",
  conflict: "/error-illustrations/maintenance.png",
  dataUnavailable: "/error-illustrations/offline.png",
  forbidden: "/error-illustrations/forbidden.png",
  gatewayTimeout: "/error-illustrations/time-sync.png",
  maintenance: "/error-illustrations/maintenance.png",
  mapLoad: "/error-illustrations/not-found.png",
  notFound: "/error-illustrations/not-found.png",
  offline: offlineImageB64,
  rateLimited: "/error-illustrations/maintenance.png",
  routeFailed: "/error-illustrations/not-found.png",
  server: "/error-illustrations/server-error.png",
  serviceUnavailable: "/error-illustrations/server-error.png",
  sessionExpired: "/error-illustrations/time-sync.png",
  timeSync: "/error-illustrations/time-sync.png",
  trainingRoom: "/error-illustrations/maintenance.png",
  unauthorized: "/error-illustrations/forbidden.png",
};

type ErrorStateProps = {
  dictionary: AppDictionary;
  digest?: string;
  kind: ErrorKind;
  onRetry?: () => void;
};

export function ErrorState({
  dictionary,
  digest,
  kind,
  onRetry,
}: ErrorStateProps) {
  const titleId = useId();
  const t = (textKey: string, values: Record<string, string | number> = {}) =>
    uiText(dictionary, textKey, values);
  const errorKey = `error.${kind}`;
  const isRefreshLink =
    kind === "maintenance" || kind === "offline" || kind === "timeSync";

  return (
    <main className={styles.page}>
      <section aria-labelledby={titleId} className={styles.panel}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>{t(`${errorKey}.eyebrow`)}</p>
          <h1 id={titleId}>{t(`${errorKey}.title`)}</h1>
          <p className={styles.description}>{t(`${errorKey}.description`)}</p>
          {digest ? (
            <p className={styles.reference}>
              {t("error.reference", { digest })}
            </p>
          ) : null}
          <div className={styles.actions}>
            {onRetry ? (
              <button onClick={onRetry} type="button">
                <RefreshCw aria-hidden="true" />
                {t("error.action.retry")}
              </button>
            ) : null}
            <Link href="/">
              {isRefreshLink ? (
                <RefreshCw aria-hidden="true" />
              ) : (
                <Home aria-hidden="true" />
              )}
              {t(isRefreshLink ? "error.action.retry" : "error.action.home")}
            </Link>
          </div>
        </div>
        <div className={styles.illustration}>
          <Image
            alt={t(`${errorKey}.imageAlt`)}
            height={420}
            priority
            sizes="(max-width: 720px) 78vw, 360px"
            src={ERROR_IMAGES[kind]}
            unoptimized
            width={420}
          />
        </div>
      </section>
    </main>
  );
}
