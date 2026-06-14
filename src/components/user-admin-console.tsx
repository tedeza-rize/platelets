"use client";

import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { type AppDictionary, uiText } from "@/lib/i18n";
import type { UserAccount, UserRole } from "@/lib/users";
import styles from "./role-console.module.css";

const emptyForm = {
  department: "",
  email: "",
  name: "",
  password: "",
  phone: "",
  role: "field_worker" as UserRole,
  username: "",
};

export function UserAdminConsole({
  dictionary,
}: {
  dictionary: AppDictionary;
}) {
  const t = useCallback((key: string) => uiText(dictionary, key), [dictionary]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function updateForm<TKey extends keyof typeof form>(
    key: TKey,
    value: (typeof form)[TKey],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      users?: UserAccount[];
    } | null;

    if (!response.ok || !payload?.users) {
      throw new Error(payload?.error ?? t("Could not load users."));
    }

    setUsers(payload.users);
  }, [t]);

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

    const response = await fetch("/api/admin/users", {
      body: JSON.stringify(form),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      setError(payload?.error ?? t("Could not save user."));
      return;
    }

    setForm(emptyForm);
    setNotice(t("User saved."));
    await refresh();
  }

  async function remove(id: string) {
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setError(t("Could not delete user."));
      return;
    }

    setNotice(t("User deleted."));
    await refresh();
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <h1>{t("Staff accounts")}</h1>
            <p>{t("Create dispatcher and field worker accounts.")}</p>
          </div>
          <button className={styles.secondary} onClick={refresh} type="button">
            <RefreshCw aria-hidden="true" size={16} />
            {t("Refresh")}
          </button>
        </header>

        <form className={styles.card} onSubmit={create}>
          <div className={styles.grid}>
            <label className={styles.field}>
              {t("Username")}
              <input
                onChange={(event) => updateForm("username", event.target.value)}
                required
                value={form.username}
              />
            </label>
            <label className={styles.field}>
              {t("Name")}
              <input
                onChange={(event) => updateForm("name", event.target.value)}
                required
                value={form.name}
              />
            </label>
            <label className={styles.field}>
              {t("Email")}
              <input
                onChange={(event) => updateForm("email", event.target.value)}
                required
                type="email"
                value={form.email}
              />
            </label>
            <label className={styles.field}>
              {t("Temporary password")}
              <input
                onChange={(event) => updateForm("password", event.target.value)}
                required
                type="password"
                value={form.password}
              />
            </label>
            <label className={styles.field}>
              {t("Department")}
              <input
                onChange={(event) =>
                  updateForm("department", event.target.value)
                }
                value={form.department}
              />
            </label>
            <label className={styles.field}>
              {t("Phone")}
              <input
                onChange={(event) => updateForm("phone", event.target.value)}
                value={form.phone}
              />
            </label>
            <label className={styles.field}>
              {t("Role")}
              <select
                onChange={(event) =>
                  updateForm("role", event.target.value as UserRole)
                }
                value={form.role}
              >
                <option value="dispatcher">{t("Dispatcher")}</option>
                <option value="field_worker">{t("Field worker")}</option>
                <option value="admin">{t("Administrator")}</option>
              </select>
            </label>
          </div>
          <div className={styles.actions}>
            <button className={styles.primary} type="submit">
              <Plus aria-hidden="true" size={16} />
              {t("Create account")}
            </button>
          </div>
          {notice ? <p className={styles.notice}>{notice}</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
        </form>

        <section className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("Username")}</th>
                <th>{t("Name")}</th>
                <th>{t("Role")}</th>
                <th>{t("Department")}</th>
                <th>{t("Phone")}</th>
                <th>{t("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.name}</td>
                  <td>{t(user.role)}</td>
                  <td>{user.department || "-"}</td>
                  <td>{user.phone || "-"}</td>
                  <td>
                    <button
                      className={styles.danger}
                      onClick={() => remove(user.id)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={16} />
                      {t("Delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </section>
    </main>
  );
}
