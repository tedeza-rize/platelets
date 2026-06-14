"use client";

import { Pencil, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { type AppDictionary, uiText } from "@/lib/i18n";
import type { UserAccount, UserRole } from "@/lib/users";
import styles from "./role-console.module.css";

type UserErrorCode =
  | "invalid_input"
  | "last_admin"
  | "not_found"
  | "protected_account"
  | "self_delete"
  | "self_role_change"
  | "session_required"
  | "sudo_required";

const errorMessageKeys: Record<UserErrorCode, string> = {
  invalid_input: "Check the account information and try again.",
  last_admin: "Keep at least one administrator account.",
  not_found: "The account could not be found.",
  protected_account: "The bootstrap sudo account is protected.",
  self_delete: "You cannot delete your own account.",
  self_role_change: "You cannot change your own role.",
  session_required: "Sign in again to continue.",
  sudo_required: "Only a sudo administrator can manage sudo accounts.",
};

const emptyForm = {
  department: "",
  email: "",
  name: "",
  password: "",
  phone: "",
  role: "field_worker" as UserRole,
  username: "",
};

function submitLabelKey(isSaving: boolean, editingId: string) {
  if (isSaving) {
    return "Saving...";
  }

  return editingId ? "Save changes" : "Create account";
}

export function UserAdminConsole({
  currentUserId,
  dictionary,
  viewerRole,
}: {
  currentUserId: string;
  dictionary: AppDictionary;
  viewerRole: "admin" | "sudo";
}) {
  const t = useCallback((key: string) => uiText(dictionary, key), [dictionary]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState("");

  function updateForm<TKey extends keyof typeof form>(
    key: TKey,
    value: (typeof form)[TKey],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        users?: UserAccount[];
      } | null;

      if (!(response.ok && payload?.users)) {
        throw new Error(t("Could not load users."));
      }

      setUsers(payload.users);
    } finally {
      setIsLoading(false);
    }
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

  function apiErrorMessage(
    errorCode: UserErrorCode | undefined,
    fallbackKey: string,
  ) {
    return t(errorCode ? errorMessageKeys[errorCode] : fallbackKey);
  }

  function beginEdit(user: UserAccount) {
    setEditingId(user.id);
    setForm({
      department: user.department,
      email: user.email,
      name: user.name,
      password: "",
      phone: user.phone,
      role: user.role,
      username: user.username,
    });
    setError("");
    setNotice("");
  }

  function cancelEdit() {
    setEditingId("");
    setForm(emptyForm);
    setError("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSaving(true);

    try {
      const response = await fetch(
        editingId ? `/api/admin/users/${editingId}` : "/api/admin/users",
        {
          body: JSON.stringify(form),
          headers: { "Content-Type": "application/json" },
          method: editingId ? "PATCH" : "POST",
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        errorCode?: UserErrorCode;
        sessionRevoked?: boolean;
      } | null;

      if (!response.ok) {
        setError(
          apiErrorMessage(
            payload?.errorCode,
            editingId ? "Could not update user." : "Could not save user.",
          ),
        );
        return;
      }

      if (editingId === currentUserId && payload?.sessionRevoked) {
        window.location.assign("/login");
        return;
      }

      setForm(emptyForm);
      setEditingId("");
      setNotice(t(editingId ? "User updated." : "User saved."));
      await refresh();
    } finally {
      setIsSaving(false);
    }
  }

  async function remove(id: string) {
    setPendingDeleteId("");
    setError("");
    setNotice("");
    setDeletingId(id);
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as {
        errorCode?: UserErrorCode;
      } | null;

      if (!response.ok) {
        setError(apiErrorMessage(payload?.errorCode, "Could not delete user."));
        return;
      }

      setNotice(t("User deleted."));
      await refresh();
    } finally {
      setDeletingId("");
    }
  }

  const editingUser = users.find((user) => user.id === editingId);
  const adminCount = users.filter(
    (user) => user.role === "admin" || user.role === "sudo",
  ).length;

  function canEdit(user: UserAccount) {
    return viewerRole === "sudo" || user.role !== "sudo";
  }

  function canDelete(user: UserAccount) {
    if (user.id === currentUserId || user.username === "sudo") return false;
    if (viewerRole !== "sudo" && user.role === "sudo") return false;
    return (user.role !== "admin" && user.role !== "sudo") || adminCount > 1;
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <h1>{t("Staff accounts")}</h1>
            <p>{t("Create dispatcher and field worker accounts.")}</p>
          </div>
          <button
            className={styles.secondary}
            disabled={isLoading}
            onClick={refresh}
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              className={isLoading ? styles.spin : undefined}
              size={16}
            />
            {t("Refresh")}
          </button>
        </header>

        <form aria-busy={isSaving} className={styles.card} onSubmit={save}>
          {editingUser ? (
            <h2 className={styles.formTitle}>
              {t("Edit account")}: {editingUser.name}
            </h2>
          ) : null}
          <div className={styles.grid}>
            <label className={styles.field}>
              {t("Username")}
              <input
                onChange={(event) => updateForm("username", event.target.value)}
                readOnly={editingUser?.username === "sudo"}
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
              {t(editingId ? "New password (optional)" : "Temporary password")}
              <input
                onChange={(event) => updateForm("password", event.target.value)}
                required={!editingId}
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
                {viewerRole === "sudo" ? (
                  <option value="sudo">{t("sudo")}</option>
                ) : null}
              </select>
            </label>
          </div>
          <div className={styles.actions}>
            <button
              className={styles.primary}
              disabled={isSaving}
              type="submit"
            >
              {editingId ? (
                <Save aria-hidden="true" size={16} />
              ) : (
                <Plus aria-hidden="true" size={16} />
              )}
              {t(submitLabelKey(isSaving, editingId))}
            </button>
            {editingId ? (
              <button
                className={styles.secondary}
                disabled={isSaving}
                onClick={cancelEdit}
                type="button"
              >
                <X aria-hidden="true" size={16} />
                {t("Cancel")}
              </button>
            ) : null}
          </div>
          {notice ? <output className={styles.notice}>{notice}</output> : null}
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </form>

        <section
          aria-busy={isLoading}
          className={styles.tableCard}
          aria-label={t("Staff account list")}
        >
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
              {isLoading ? (
                <tr>
                  <td className={styles.stateCell} colSpan={6}>
                    <RefreshCw
                      aria-hidden="true"
                      className={styles.spin}
                      size={20}
                    />
                    {t("Loading users...")}
                  </td>
                </tr>
              ) : null}
              {!isLoading && users.length === 0 ? (
                <tr>
                  <td className={styles.stateCell} colSpan={6}>
                    {t("No staff accounts are available.")}
                  </td>
                </tr>
              ) : null}
              {!isLoading &&
                users.map((user) => (
                  <tr key={user.id}>
                    <td data-label={t("Username")}>{user.username}</td>
                    <td data-label={t("Name")}>{user.name}</td>
                    <td data-label={t("Role")}>{t(user.role)}</td>
                    <td data-label={t("Department")}>
                      {user.department || "-"}
                    </td>
                    <td data-label={t("Phone")}>{user.phone || "-"}</td>
                    <td data-label={t("Actions")}>
                      <div className={styles.tableActions}>
                        {canEdit(user) ? (
                          <button
                            className={styles.secondary}
                            disabled={Boolean(deletingId)}
                            onClick={() => beginEdit(user)}
                            type="button"
                          >
                            <Pencil aria-hidden="true" size={16} />
                            {t("Edit")}
                          </button>
                        ) : null}
                        {canDelete(user) && pendingDeleteId !== user.id ? (
                          <button
                            className={styles.danger}
                            disabled={Boolean(deletingId)}
                            onClick={() => setPendingDeleteId(user.id)}
                            type="button"
                          >
                            <Trash2 aria-hidden="true" size={16} />
                            {t("Delete")}
                          </button>
                        ) : null}
                        {canDelete(user) && pendingDeleteId === user.id ? (
                          <>
                            <button
                              className={styles.secondary}
                              disabled={Boolean(deletingId)}
                              onClick={() => setPendingDeleteId("")}
                              type="button"
                            >
                              <X aria-hidden="true" size={16} />
                              {t("Cancel")}
                            </button>
                            <button
                              className={styles.danger}
                              disabled={Boolean(deletingId)}
                              onClick={() => remove(user.id)}
                              type="button"
                            >
                              <Trash2 aria-hidden="true" size={16} />
                              {t("Delete")}
                            </button>
                          </>
                        ) : null}
                        {canDelete(user) ? null : (
                          <span className={styles.protected}>
                            {t("Protected")}
                          </span>
                        )}
                      </div>
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
