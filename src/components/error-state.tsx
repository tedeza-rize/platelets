"use client";

import { Home, RefreshCw } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useId } from "react";
import { type AppDictionary, uiText } from "@/lib/i18n";
import styles from "./error-state.module.css";
import { offlineImageB64 } from "./offline-image-b64";

export type ErrorKind = "maintenance" | "notFound" | "offline" | "server";

const ERROR_IMAGES: Record<ErrorKind, string> = {
  maintenance: "/error-illustrations/maintenance.png",
  notFound: "/error-illustrations/not-found.png",
  offline: offlineImageB64,
  server: "/error-illustrations/server-error.png",
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
  const isRefreshLink = kind === "maintenance" || kind === "offline";

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
