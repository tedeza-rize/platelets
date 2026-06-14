"use client";

import { ClipboardList, PlusCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Incident } from "@/lib/disaster-response/types";
import { type AppDictionary, uiText } from "@/lib/i18n";
import styles from "./role-console.module.css";

const defaultIncident = {
  address: "",
  description: "",
  latitude: "37.5665",
  longitude: "126.9780",
  riskLevel: "medium",
  title: "",
  type: "fire",
};

export function FieldConsole({ dictionary }: { dictionary: AppDictionary }) {
  const t = useCallback((key: string) => uiText(dictionary, key), [dictionary]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [form, setForm] = useState(defaultIncident);
  const [tab, setTab] = useState<"list" | "report">("list");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function updateForm<TKey extends keyof typeof form>(
    key: TKey,
    value: (typeof form)[TKey],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const refresh = useCallback(async () => {
    const response = await fetch("/api/disaster/incidents", {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as {
      incidents?: Incident[];
    } | null;

    setIncidents(payload?.incidents ?? []);
  }, []);

  useEffect(() => {
    refresh().catch((requestError) =>
      setError(
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      ),
    );
  }, [refresh]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");

    const response = await fetch("/api/disaster/incidents", {
      body: JSON.stringify({
        ...form,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      setError(payload?.error ?? t("Could not create incident."));
      return;
    }

    setForm(defaultIncident);
    setNotice(t("Incident reported."));
    setTab("list");
    await refresh();
  }

  return (
    <main className={styles.page}>
      <section className={styles.narrowShell}>
        <header className={styles.header}>
          <div>
            <h1>{t("Field response")}</h1>
            <p>{t("Review active incidents and send a quick report.")}</p>
          </div>
          <button className={styles.secondary} onClick={refresh} type="button">
            <RefreshCw aria-hidden="true" size={16} />
            {t("Refresh")}
          </button>
        </header>

        {tab === "list" ? (
          <section className={styles.incidentList}>
            {incidents.map((incident) => (
              <article className={styles.incident} key={incident.id}>
                <strong>{incident.title}</strong>
                <span>
                  {t(incident.status)} · {t(incident.riskLevel)}
                </span>
                <p>{incident.address}</p>
              </article>
            ))}
          </section>
        ) : (
          <form className={styles.card} onSubmit={create}>
            <label className={styles.field}>
              {t("Incident title")}
              <input
                onChange={(event) => updateForm("title", event.target.value)}
                required
                value={form.title}
              />
            </label>
            <label className={styles.field}>
              {t("Address")}
              <input
                onChange={(event) => updateForm("address", event.target.value)}
                required
                value={form.address}
              />
            </label>
            <div className={styles.grid}>
              <label className={styles.field}>
                {t("Latitude")}
                <input
                  inputMode="decimal"
                  onChange={(event) =>
                    updateForm("latitude", event.target.value)
                  }
                  value={form.latitude}
                />
              </label>
              <label className={styles.field}>
                {t("Longitude")}
                <input
                  inputMode="decimal"
                  onChange={(event) =>
                    updateForm("longitude", event.target.value)
                  }
                  value={form.longitude}
                />
              </label>
            </div>
            <label className={styles.field}>
              {t("Description")}
              <textarea
                onChange={(event) =>
                  updateForm("description", event.target.value)
                }
                value={form.description}
              />
            </label>
            <div className={styles.actions}>
              <button className={styles.primary} type="submit">
                <PlusCircle aria-hidden="true" size={16} />
                {t("Report incident")}
              </button>
            </div>
          </form>
        )}

        {notice ? <p className={styles.notice}>{notice}</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}
      </section>
      <nav className={styles.tabbar} aria-label={t("Field tabs")}>
        <button
          data-active={tab === "list"}
          onClick={() => setTab("list")}
          type="button"
        >
          <ClipboardList aria-hidden="true" size={16} /> {t("Incidents")}
        </button>
        <button
          data-active={tab === "report"}
          onClick={() => setTab("report")}
          type="button"
        >
          <PlusCircle aria-hidden="true" size={16} /> {t("Report")}
        </button>
        <button data-active="false" onClick={refresh} type="button">
          <RefreshCw aria-hidden="true" size={16} /> {t("Refresh")}
        </button>
      </nav>
    </main>
  );
}
