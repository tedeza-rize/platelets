import { isPasswordValid } from "@/lib/password-policy";
import type { SetupDictionary } from "@/lib/setup-i18n";
import type {
  AccountForm,
  ApiKeysForm,
  DatabaseEngine,
  DatabaseForm,
} from "./setup-wizard-types";

export type AccountFieldErrors = Partial<Record<keyof AccountForm, string>>;
export type ApiFieldErrors = Partial<Record<keyof ApiKeysForm, string>>;
export type DatabaseFieldErrors = Partial<Record<keyof DatabaseForm, string>>;

export function validateAccount(account: AccountForm, copy: SetupDictionary) {
  const errors = getAccountFieldErrors(account, copy);
  if (errors.fullName) return errors.fullName;
  if (errors.email) return errors.email;
  if (errors.password) return errors.password;
  if (errors.confirmPassword) return errors.confirmPassword;
  return null;
}

export function getAccountFieldErrors(
  account: AccountForm,
  copy: SetupDictionary,
): AccountFieldErrors {
  return {
    confirmPassword:
      account.password === account.confirmPassword
        ? undefined
        : copy["validation.account.passwordConfirm"],
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email.trim())
      ? undefined
      : copy["validation.account.email"],
    fullName: account.fullName.trim()
      ? undefined
      : copy["validation.account.fullName"],
    password: isPasswordValid(account.password)
      ? undefined
      : copy["validation.account.password"],
  };
}

function isHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function getApiFieldErrors(
  apiKeys: ApiKeysForm,
  copy: SetupDictionary,
): ApiFieldErrors {
  return {
    openaiBaseUrl: isHttpsUrl(apiKeys.openaiBaseUrl.trim())
      ? undefined
      : copy["validation.api.openaiBaseUrl"],
  };
}

export function validateApiKeys(apiKeys: ApiKeysForm, copy: SetupDictionary) {
  const errors = getApiFieldErrors(apiKeys, copy);

  if (errors.openaiBaseUrl) {
    return errors.openaiBaseUrl;
  }

  return null;
}

function isDatabaseConnectionUrl(engine: DatabaseEngine, value: string) {
  if (engine === "sqlite") {
    return true;
  }

  try {
    const url = new URL(value);
    const expectedProtocols =
      engine === "postgresql"
        ? new Set(["postgres:", "postgresql:"])
        : new Set(["mysql:"]);

    return expectedProtocols.has(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function getDatabaseFieldErrors(
  database: DatabaseForm,
  copy: SetupDictionary,
): DatabaseFieldErrors {
  return {
    connectionString: isDatabaseConnectionUrl(
      database.engine,
      database.connectionString.trim(),
    )
      ? undefined
      : copy["validation.database.connectionString"],
  };
}

export function validateDatabase(
  database: DatabaseForm,
  copy: SetupDictionary,
) {
  const errors = getDatabaseFieldErrors(database, copy);

  return errors.connectionString ?? null;
}
