"use client";

import { ArrowRightLeft, Database, LoaderCircle } from "lucide-react";
import { useState } from "react";
import type { DatabaseEngine } from "@/lib/database/types";
import { type AppDictionary, uiText } from "@/lib/i18n";
import styles from "./management-console.module.css";

type MigrationTarget = {
  connectionString: string;
  engine: DatabaseEngine;
};

const ENGINE_OPTIONS: DatabaseEngine[] = [
  "sqlite",
  "postgresql",
  "mysql",
  "mariadb",
];

export function DatabaseMigrationPanel({
  currentEngine,
  dictionary,
  ensureSudoSession,
}: {
  currentEngine: DatabaseEngine;
  dictionary: AppDictionary;
  ensureSudoSession: () => Promise<void>;
}) {
  const t = (key: string, values?: Record<string, number | string>) =>
    uiText(dictionary, key, values);
  const [target, setTarget] = useState<MigrationTarget>({
    connectionString: "",
    engine: currentEngine === "sqlite" ? "postgresql" : "sqlite",
  });
  const [confirmed, setConfirmed] = useState(false);
  const [tested, setTested] = useState(false);
  const [busyAction, setBusyAction] = useState<"migrate" | "test" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function updateTarget(patch: Partial<MigrationTarget>) {
    setTarget((current) => {
      const next = { ...current, ...patch };
      return next.engine === "sqlite"
        ? { ...next, connectionString: "" }
        : next;
    });
    setTested(false);
    setConfirmed(false);
    setNotice("");
    setError("");
  }

  async function request(action: "migrate" | "test") {
    setBusyAction(action);
    setNotice("");
    setError("");

    try {
      await ensureSudoSession();
      const response = await fetch("/api/admin/database-migration", {
        body: JSON.stringify({ target }),
        headers: { "Content-Type": "application/json" },
        method: action === "test" ? "PUT" : "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        errorKey?: string;
        ok?: boolean;
        result?: { totalRows?: number };
      } | null;

      if (!(response.ok && payload?.ok)) {
        throw new Error(
          payload?.errorKey
            ? t(payload.errorKey)
            : t("databaseMigration.failed"),
        );
      }

      if (action === "test") {
        setTested(true);
        setNotice(t("databaseMigration.testReady"));
        return;
      }

      setNotice(
        t("databaseMigration.completed", {
          count: payload.result?.totalRows ?? 0,
        }),
      );
      setConfirmed(false);
      setTested(false);
      window.location.reload();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t("databaseMigration.failed"),
      );
    } finally {
      setBusyAction(null);
    }
  }

  const needsConnectionString = target.engine !== "sqlite";
  const canTest =
    !busyAction &&
    (!needsConnectionString || target.connectionString.trim().length > 0);
  const canMigrate = !busyAction && tested && confirmed;

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>
          <Database aria-hidden="true" size={18} strokeWidth={2.4} />
          {t("databaseMigration.title")}
        </span>
        <span className={styles.muted}>
          {t("databaseMigration.current", { engine: currentEngine })}
        </span>
      </div>
      <p className={styles.muted}>{t("databaseMigration.description")}</p>
      <div className={styles.settingsGrid}>
        <label className={styles.fieldLabel}>
          {t("databaseMigration.target")}
          <select
            className={styles.textInput}
            disabled={Boolean(busyAction)}
            onChange={(event) =>
              updateTarget({ engine: event.target.value as DatabaseEngine })
            }
            value={target.engine}
          >
            {ENGINE_OPTIONS.map((engine) => (
              <option key={engine} value={engine}>
                {t(`databaseMigration.engine.${engine}`)}
              </option>
            ))}
          </select>
        </label>
        {needsConnectionString ? (
          <label className={styles.fieldLabel}>
            {t("databaseMigration.connectionString")}
            <input
              autoComplete="off"
              className={styles.textInput}
              disabled={Boolean(busyAction)}
              onChange={(event) =>
                updateTarget({ connectionString: event.target.value })
              }
              type="password"
              value={target.connectionString}
            />
          </label>
        ) : (
          <div className={styles.statusPanel}>
            <strong>{t("databaseMigration.sqliteTarget")}</strong>
            <span className={styles.muted}>
              {t("databaseMigration.sqliteDescription")}
            </span>
          </div>
        )}
      </div>
      <div className={styles.actions}>
        <button
          className={styles.actionButton}
          disabled={!canTest}
          onClick={() => void request("test")}
          type="button"
        >
          {busyAction === "test" ? (
            <LoaderCircle
              aria-hidden="true"
              className={styles.spinning}
              size={16}
            />
          ) : (
            <Database aria-hidden="true" size={16} />
          )}
          {t("databaseMigration.test")}
        </button>
      </div>
      <label className={styles.confirmRow}>
        <input
          checked={confirmed}
          disabled={!tested || Boolean(busyAction)}
          onChange={(event) => setConfirmed(event.target.checked)}
          type="checkbox"
        />
        <span>{t("databaseMigration.confirm")}</span>
      </label>
      <button
        className={styles.actionButton}
        disabled={!canMigrate}
        onClick={() => void request("migrate")}
        type="button"
      >
        {busyAction === "migrate" ? (
          <LoaderCircle
            aria-hidden="true"
            className={styles.spinning}
            size={16}
          />
        ) : (
          <ArrowRightLeft aria-hidden="true" size={16} />
        )}
        {t("databaseMigration.migrate")}
      </button>
      {notice ? <output className={styles.notice}>{notice}</output> : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
