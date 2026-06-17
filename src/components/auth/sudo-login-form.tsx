"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import styles from "@/components/admin/management-console.module.scss";
import { type AppDictionary, uiText } from "@/lib/i18n";

export function SudoLoginForm({ dictionary }: { dictionary: AppDictionary }) {
  const router = useRouter();
  const t = useCallback((key: string) => uiText(dictionary, key), [dictionary]);
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [notice, setNotice] = useState("");

  async function handleSudoLogin(event?: React.FormEvent) {
    if (event) {
      event.preventDefault();
    }
    const cleanPassword = password.trim();
    if (!cleanPassword) return;

    setLoggingIn(true);
    setNotice("");
    try {
      const response = await fetch("/api/auth/login", {
        body: JSON.stringify({ password: cleanPassword }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? t("로그인에 실패했습니다."));
      }

      setPassword("");
      setNotice(t("세션 활성화 완료"));
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setLoggingIn(false);
    }
  }

  return (
    <section className={styles.card}>
      <form
        onSubmit={handleSudoLogin}
        className={styles.settingsGrid}
        style={{ gridTemplateColumns: "1fr" }}
      >
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>{t("개발자 권한")}</span>
          <span className={styles.muted}>{t("세션 필요")}</span>
        </div>
        <label className={styles.fieldLabel}>
          {t("sudo 비밀번호")}
          <input
            autoComplete="current-password"
            className={styles.textInput}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        <button
          className={styles.actionButton}
          disabled={loggingIn || !password.trim()}
          type="submit"
          style={{ justifySelf: "start", marginTop: "10px" }}
        >
          {loggingIn ? (
            <RefreshCw
              aria-hidden="true"
              className={styles.spinning}
              size={16}
              strokeWidth={2.4}
            />
          ) : null}
          {t("인증")}
        </button>
      </form>
      {notice ? <output className={styles.notice}>{notice}</output> : null}
    </section>
  );
}
