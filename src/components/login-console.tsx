"use client";

import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type AppDictionary, uiText } from "@/lib/i18n";
import styles from "./role-console.module.css";

export function LoginConsole({ dictionary }: { dictionary: AppDictionary }) {
  const router = useRouter();
  const t = (key: string) => uiText(dictionary, key);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const nextUsername = String(formData.get("username") ?? "");
    const nextPassword = String(formData.get("password") ?? "");

    const response = await fetch("/api/auth/login", {
      body: JSON.stringify({ password: nextPassword, username: nextUsername }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      homePath?: string;
    } | null;

    if (!response.ok) {
      setError(payload?.error ?? t("Login failed."));
      return;
    }

    router.replace(payload?.homePath ?? "/dashboard");
  }

  return (
    <main className={styles.page}>
      <section className={styles.narrowShell}>
        <header className={styles.header}>
          <div>
            <h1>{t("Staff login")}</h1>
            <p>{t("Sign in with an assigned account.")}</p>
          </div>
        </header>
        <form className={styles.card} onSubmit={submit}>
          <label className={styles.field}>
            {t("Username")}
            <input
              autoComplete="username"
              name="username"
              onChange={(event) => setUsername(event.target.value)}
              required
              value={username}
            />
          </label>
          <label className={styles.field}>
            {t("Password")}
            <input
              autoComplete="current-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <div className={styles.actions}>
            <button
              className={styles.primary}
              disabled={!isReady}
              type="submit"
            >
              <LogIn aria-hidden="true" size={18} />
              {t("Sign in")}
            </button>
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
        </form>
      </section>
    </main>
  );
}
