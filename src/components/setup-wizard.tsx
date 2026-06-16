"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n";
import {
  formatSetupText,
  type SetupDictionaries,
  type SetupDictionaryKey,
} from "@/lib/setup-i18n";
import styles from "./setup-wizard.module.css";
import { AccountStep } from "./setup-wizard-account-step";
import {
  buildClientServerClockCheck,
  buildClockSyncCheck,
} from "./setup-wizard-clock";
import {
  ApiStep,
  EnvironmentStep,
  LicenseStep,
  SimpleSetupPanel,
} from "./setup-wizard-panels";
import { readJsonResponse, setupErrorMessage } from "./setup-wizard-response";
import {
  SetupFooter,
  SetupSidebar,
  SetupTopControls,
  setupSteps,
} from "./setup-wizard-shell";
import {
  type AccountForm,
  type ApiKeysForm,
  type DatabaseForm,
  databaseFromStatus,
  type EnvironmentCheck,
  initialAccount,
  initialApiKeys,
  type StatusPayload,
  type ThemeMode,
} from "./setup-wizard-types";
import {
  validateAccount,
  validateApiKeys,
  validateDatabase,
} from "./setup-wizard-validation";

export function SetupWizard({
  initialLocale,
  initialStatus = null,
  setupDictionaries,
}: {
  initialLocale: Locale;
  initialStatus?: StatusPayload | null;
  setupDictionaries: SetupDictionaries;
}) {
  const router = useRouter();
  const initialJsonError = setupDictionaries[initialLocale]["json.failed"];
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [stepIndex, setStepIndex] = useState(0);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [sudo, setSudo] = useState<AccountForm>(initialAccount);
  const [admin, setAdmin] = useState<AccountForm>(initialAccount);
  const [apiKeys, setApiKeys] = useState<ApiKeysForm>(initialApiKeys);
  const [database, setDatabase] = useState<DatabaseForm>(() =>
    databaseFromStatus(initialStatus),
  );
  const [status, setStatus] = useState<StatusPayload | null>(initialStatus);
  const [clientClockCheck, setClientClockCheck] =
    useState<EnvironmentCheck | null>(null);
  const [apiTested, setApiTested] = useState(false);
  const [apiTestMessage, setApiTestMessage] = useState<string | null>(null);
  const [databaseTested, setDatabaseTested] = useState(
    () => databaseFromStatus(initialStatus).engine === "sqlite",
  );
  const [databaseTestMessage, setDatabaseTestMessage] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isDeletingDatabase, setIsDeletingDatabase] = useState(false);
  const [attemptedSteps, setAttemptedSteps] = useState<Set<string>>(
    () => new Set(),
  );

  const activeStep = setupSteps[stepIndex];
  const isLastStep = stepIndex === setupSteps.length - 1;
  const copy = setupDictionaries[locale];
  const t = (
    key: SetupDictionaryKey,
    values?: Record<string, string | number>,
  ) => formatSetupText(copy, key, values);
  useEffect(() => {
    let isDisposed = false;

    setIsHydrated(true);
    const storedLocale = window.localStorage.getItem("platelets.setup.locale");
    const storedTheme = window.localStorage.getItem("platelets.setup.theme");

    if (storedLocale === "ko" || storedLocale === "en") {
      setLocale(storedLocale);
    } else if (navigator.language.toLowerCase().startsWith("ko")) {
      setLocale("ko");
    }

    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }

    const startedAt = Date.now();
    fetch("/api/setup/status", { cache: "no-store" })
      .then((response) =>
        readJsonResponse<StatusPayload>(response, initialJsonError),
      )
      .then((payload: StatusPayload) => {
        const receivedAt = Date.now();

        if (!isDisposed) {
          setStatus(payload);
          setClientClockCheck(
            buildClientServerClockCheck(payload, startedAt, receivedAt),
          );
        }
      })
      .catch((requestError) => {
        if (!isDisposed) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : String(requestError),
          );
        }
      });

    return () => {
      isDisposed = true;
    };
  }, [initialJsonError]);

  const environmentChecks = useMemo(() => {
    const checks = [...(status?.environment.checks ?? [])];

    if (clientClockCheck) {
      checks.push(clientClockCheck);
    }

    return checks;
  }, [clientClockCheck, status]);

  const visibleEnvironmentChecks = useMemo(() => {
    const checks = status?.environment.checks ?? [];
    const serverClockCheck = checks.find(
      (check) => check.id === "server-ntp-clock",
    );
    const clockSyncCheck = buildClockSyncCheck(
      serverClockCheck,
      clientClockCheck,
    );

    return [
      ...checks.filter((check) => check.id !== "server-ntp-clock"),
      ...(clockSyncCheck ? [clockSyncCheck] : []),
    ];
  }, [clientClockCheck, status]);

  const environmentReady =
    environmentChecks.length > 0 &&
    Boolean(clientClockCheck) &&
    environmentChecks.every((check) => check.ok);
  const databaseNeedsTest = database.engine !== "sqlite";
  const databaseReady = !databaseNeedsTest || databaseTested;

  const stepError = useMemo(() => {
    if (activeStep.id === "license" && !acceptedTerms) {
      return copy["validation.license"];
    }
    if (activeStep.id === "environment" && !environmentReady) {
      return copy["validation.environment"];
    }
    if (activeStep.id === "environment") {
      const databaseValidationError = validateDatabase(database, copy);

      if (databaseValidationError) {
        return databaseValidationError;
      }
    }
    if (activeStep.id === "environment" && !databaseReady) {
      return copy["validation.database.test"];
    }
    if (activeStep.id === "sudo") {
      return validateAccount(sudo, copy);
    }
    if (activeStep.id === "admin") {
      return validateAccount(admin, copy);
    }
    if (activeStep.id === "api") {
      const apiValidationError = validateApiKeys(apiKeys, copy);

      if (apiValidationError) {
        return apiValidationError;
      }
    }
    if (activeStep.id === "api" && !apiTested) {
      return copy["validation.api"];
    }
    return null;
  }, [
    acceptedTerms,
    activeStep.id,
    admin,
    apiKeys,
    apiTested,
    database,
    databaseReady,
    environmentReady,
    sudo,
    copy,
  ]);

  const showCurrentStepValidation = attemptedSteps.has(activeStep.id);

  function updateSudo(patch: Partial<AccountForm>) {
    setSudo((current) => ({ ...current, ...patch }));
  }

  function updateAdmin(patch: Partial<AccountForm>) {
    setAdmin((current) => ({ ...current, ...patch }));
  }

  function updateApiKeys(patch: Partial<ApiKeysForm>) {
    setApiKeys((current) => ({ ...current, ...patch }));
    setApiTested(false);
  }

  function updateDatabase(patch: Partial<DatabaseForm>) {
    setDatabase((current) => {
      const next = { ...current, ...patch };

      if (patch.engine === "sqlite") {
        return { ...next, connectionString: "" };
      }

      return next;
    });
    setDatabaseTested(patch.engine === "sqlite");
    setDatabaseTestMessage(null);
  }

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    window.localStorage.setItem("platelets.setup.locale", nextLocale);
  }

  function changeTheme(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    window.localStorage.setItem("platelets.setup.theme", nextTheme);
  }

  async function testApiKeys() {
    setIsBusy(true);
    setError(null);
    setApiTestMessage(null);

    try {
      const response = await fetch("/api/setup/test-keys", {
        body: JSON.stringify(apiKeys),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await readJsonResponse<{
        errorKey?: string;
        ok?: boolean;
      }>(response, copy["json.failed"]);

      if (!(response.ok && payload.ok)) {
        throw new Error(setupErrorMessage(payload, copy, "api.failed"));
      }

      setApiTested(true);
      setApiTestMessage(copy["api.ready"]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function testDatabase() {
    const databaseValidationError = validateDatabase(database, copy);

    if (databaseValidationError) {
      setError(databaseValidationError);
      setDatabaseTested(false);
      return;
    }

    setIsBusy(true);
    setError(null);
    setDatabaseTestMessage(null);

    try {
      const response = await fetch("/api/setup/test-database", {
        body: JSON.stringify({ database }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await readJsonResponse<{
        errorKey?: string;
        ok?: boolean;
      }>(response, copy["json.failed"]);

      if (!(response.ok && payload.ok)) {
        const errorKey = payload.errorKey;

        throw new Error(
          errorKey && Object.hasOwn(copy, errorKey)
            ? copy[errorKey as SetupDictionaryKey]
            : copy["database.failed"],
        );
      }

      setDatabaseTested(true);
      setDatabaseTestMessage(copy["database.ready"]);
    } catch (requestError) {
      setDatabaseTested(false);
      setError(
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteDatabaseFile() {
    setIsBusy(true);
    setIsDeletingDatabase(true);
    setError(null);

    const startedAt = Date.now();

    try {
      const response = await fetch("/api/setup/status", {
        cache: "no-store",
        method: "DELETE",
      });
      const payload = await readJsonResponse<
        StatusPayload & { errorKey?: string; ok?: boolean }
      >(response, copy["json.failed"]);
      const receivedAt = Date.now();

      if (!(response.ok && payload.ok)) {
        const errorKey = payload.errorKey;

        throw new Error(
          errorKey && Object.hasOwn(copy, errorKey)
            ? copy[errorKey as SetupDictionaryKey]
            : copy["environment.sqlite.deleteFailed"],
        );
      }

      setStatus(payload);
      setClientClockCheck(
        buildClientServerClockCheck(payload, startedAt, receivedAt),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    } finally {
      setIsDeletingDatabase(false);
      setIsBusy(false);
    }
  }

  async function completeInstallation() {
    setIsBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/setup/complete", {
        body: JSON.stringify({
          admin,
          apiKeys,
          database,
          licenseAccepted: acceptedTerms,
          sudo,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await readJsonResponse<{
        errorKey?: string;
        ok?: boolean;
      }>(response, copy["json.failed"]);

      if (!(response.ok && payload.ok)) {
        throw new Error(setupErrorMessage(payload, copy, "install.failed"));
      }

      router.push("/");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    } finally {
      setIsBusy(false);
    }
  }

  function goNext() {
    setError(null);

    if (stepError) {
      setAttemptedSteps((current) => new Set(current).add(activeStep.id));
      setError(stepError);
      return;
    }

    if (isLastStep) {
      void completeInstallation();
      return;
    }

    setStepIndex((current) => Math.min(current + 1, setupSteps.length - 1));
  }

  return (
    <main className={styles.page} data-theme={theme}>
      <section className={styles.shell} aria-label={copy["brand.wizardAria"]}>
        <SetupSidebar copy={copy} stepIndex={stepIndex} t={t} />

        <div className={styles.content}>
          <SetupTopControls
            copy={copy}
            locale={locale}
            onLocaleChange={changeLocale}
            onThemeChange={changeTheme}
            theme={theme}
          />
          <div className={styles.mainPanel}>
            <span className={styles.eyebrow}>
              {t("status.step", {
                current: stepIndex + 1,
                total: setupSteps.length,
              })}
            </span>

            {activeStep.id === "start" && (
              <SimpleSetupPanel
                info={copy["start.info"]}
                lead={copy["start.lead"]}
                title={copy["start.title"]}
              />
            )}

            {activeStep.id === "license" && (
              <LicenseStep
                acceptedTerms={acceptedTerms}
                copy={copy}
                onAcceptedTermsChange={setAcceptedTerms}
              />
            )}

            {activeStep.id === "environment" && (
              <EnvironmentStep
                copy={copy}
                database={database}
                databaseNeedsTest={databaseNeedsTest}
                databaseTestMessage={databaseTestMessage}
                isBusy={isBusy}
                isDeletingDatabase={isDeletingDatabase}
                isHydrated={isHydrated}
                onDatabaseChange={updateDatabase}
                onDatabaseDelete={deleteDatabaseFile}
                onDatabaseTest={testDatabase}
                showValidation={showCurrentStepValidation}
                status={status}
                visibleEnvironmentChecks={visibleEnvironmentChecks}
              />
            )}

            {activeStep.id === "sudo" && (
              <AccountStep
                account={sudo}
                copy={copy}
                t={t}
                description={copy["sudo.description"]}
                onChange={updateSudo}
                showValidation={showCurrentStepValidation}
                title={copy["sudo.title"]}
              />
            )}

            {activeStep.id === "admin" && (
              <AccountStep
                account={admin}
                copy={copy}
                t={t}
                description={copy["admin.description"]}
                onChange={updateAdmin}
                showValidation={showCurrentStepValidation}
                title={copy["admin.title"]}
              />
            )}

            {activeStep.id === "api" && (
              <ApiStep
                apiKeys={apiKeys}
                apiTestMessage={apiTestMessage}
                copy={copy}
                isBusy={isBusy}
                isHydrated={isHydrated}
                onApiKeysChange={updateApiKeys}
                onApiTest={testApiKeys}
                showValidation={showCurrentStepValidation}
              />
            )}

            {activeStep.id === "finish" && (
              <SimpleSetupPanel
                info={copy["finish.info"]}
                lead={copy["finish.lead"]}
                title={copy["finish.title"]}
              />
            )}

            {error ? <p className={styles.errorText}>{error}</p> : null}
          </div>

          <SetupFooter
            copy={copy}
            isBusy={isBusy}
            isHydrated={isHydrated}
            isLastStep={isLastStep}
            onBack={() => setStepIndex((current) => Math.max(0, current - 1))}
            onContinue={goNext}
            stepIndex={stepIndex}
          />
        </div>
      </section>
    </main>
  );
}
