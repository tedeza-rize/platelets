import { Check, X } from "lucide-react";
import { useId } from "react";
import {
  getPasswordRequirementResults,
  type PasswordRequirementId,
} from "@/lib/password-policy";
import type { SetupDictionary, SetupDictionaryKey } from "@/lib/setup-i18n";
import styles from "./setup-wizard-content.module.css";
import { Field } from "./setup-wizard-controls";
import type { AccountForm } from "./setup-wizard-types";
import { getAccountFieldErrors } from "./setup-wizard-validation";

const passwordRequirementLabelKeys: Record<
  PasswordRequirementId,
  SetupDictionaryKey
> = {
  length: "password.requirement.length",
  lowercase: "password.requirement.lowercase",
  number: "password.requirement.number",
  symbol: "password.requirement.symbol",
  uppercase: "password.requirement.uppercase",
};

type Translator = (
  key: SetupDictionaryKey,
  values?: Record<string, string | number>,
) => string;

export function AccountStep({
  account,
  copy,
  description,
  onChange,
  showValidation,
  t,
  title,
}: {
  account: AccountForm;
  copy: SetupDictionary;
  description: string;
  onChange: (patch: Partial<AccountForm>) => void;
  showValidation: boolean;
  t: Translator;
  title: string;
}) {
  const passwordRequirementsId = useId();
  const passwordErrorId = `${passwordRequirementsId}-error`;
  const errors = getAccountFieldErrors(account, copy);
  const fullNameError = showValidation ? errors.fullName : undefined;
  const emailError = showValidation || account.email ? errors.email : undefined;
  const passwordError =
    showValidation || account.password ? errors.password : undefined;
  const confirmPasswordError =
    showValidation || account.confirmPassword
      ? errors.confirmPassword
      : undefined;

  return (
    <>
      <h1>{title}</h1>
      <p className={styles.lead}>{description}</p>
      <div className={styles.grid}>
        <Field error={fullNameError} label={t("field.fullName")}>
          <input
            autoComplete="name"
            onChange={(event) => onChange({ fullName: event.target.value })}
            value={account.fullName}
          />
        </Field>
        <Field error={emailError} label={t("field.email")}>
          <input
            autoComplete="email"
            onChange={(event) => onChange({ email: event.target.value })}
            type="email"
            value={account.email}
          />
        </Field>
      </div>
      <label
        className={`${styles.field} ${
          passwordError ? styles.fieldInvalid : ""
        }`}
        htmlFor={passwordRequirementsId}
      >
        <span>{t("field.password")}</span>
        <input
          autoComplete="new-password"
          aria-describedby={`${passwordRequirementsId}-requirements${
            passwordError ? ` ${passwordErrorId}` : ""
          }`}
          aria-invalid={Boolean(passwordError) || undefined}
          id={passwordRequirementsId}
          onChange={(event) => onChange({ password: event.target.value })}
          type="password"
          value={account.password}
        />
        {passwordError ? (
          <span className={styles.fieldError} id={passwordErrorId}>
            {passwordError}
          </span>
        ) : null}
      </label>
      <PasswordRequirementList
        id={`${passwordRequirementsId}-requirements`}
        password={account.password}
        t={t}
      />
      <Field error={confirmPasswordError} label={t("field.confirmPassword")}>
        <input
          autoComplete="new-password"
          onChange={(event) =>
            onChange({ confirmPassword: event.target.value })
          }
          type="password"
          value={account.confirmPassword}
        />
      </Field>
    </>
  );
}

function PasswordRequirementList({
  id,
  password,
  t,
}: {
  id: string;
  password: string;
  t: Translator;
}) {
  const requirements = getPasswordRequirementResults(password);

  return (
    <output aria-live="polite" className={styles.passwordChecklist} id={id}>
      <span className={styles.passwordChecklistTitle}>
        {t("password.requirement.title")}
      </span>
      <ul>
        {requirements.map((requirement) => {
          const status = requirement.met
            ? t("password.requirement.met")
            : t("password.requirement.missing");

          return (
            <li
              className={
                requirement.met
                  ? styles.passwordRequirementMet
                  : styles.passwordRequirementMissing
              }
              key={requirement.id}
            >
              {requirement.met ? (
                <Check aria-hidden="true" size={15} />
              ) : (
                <X aria-hidden="true" size={15} />
              )}
              <span>{t(passwordRequirementLabelKeys[requirement.id])}</span>
              <span className={styles.visuallyHidden}>{status}</span>
            </li>
          );
        })}
      </ul>
    </output>
  );
}
