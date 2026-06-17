"use client";

import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import styles from "@/components/admin/role-console.module.scss";
import { type AppDictionary, uiText } from "@/lib/i18n";

export function LoginConsole({
  dictionary,
  next = "",
}: {
  dictionary: AppDictionary;
  next?: string;
}) {
  const router = useRouter();
  const errorId = useId();
  const t = (key: string) => uiText(dictionary, key);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
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
      setError(
        response.status === 429
          ? t("Too many sign-in attempts. Try again shortly.")
          : payload?.error || t("Login failed."),
      );
      setIsSubmitting(false);
      return;
    }

    router.replace(next || payload?.homePath || "/dashboard");
  }

  return (
    <div className={styles.pageCentered} style={{ padding: 0 }}>
      <main className={styles.pageCentered} style={{ flex: 1, width: "100%" }}>
        <section className={styles.narrowShell} style={{ width: "100%" }}>
          <header className={styles.header}>
            <div>
              <h1>{t("Staff login")}</h1>
              <p>{t("Sign in with an assigned account.")}</p>
            </div>
          </header>
          <form
            aria-busy={isSubmitting}
            className={styles.card}
            onSubmit={submit}
          >
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
                aria-describedby={error ? errorId : undefined}
                aria-invalid={Boolean(error)}
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
                disabled={!isReady || isSubmitting}
                type="submit"
              >
                <LogIn aria-hidden="true" size={18} />
                {t(isSubmitting ? "Signing in..." : "Sign in")}
              </button>
            </div>
            {error ? (
              <p className={styles.error} id={errorId} role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </section>
      </main>
    </div>
  );
}
