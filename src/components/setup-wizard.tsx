"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Cloud,
  Database,
  FileCheck2,
  KeyRound,
  LoaderCircle,
  ServerCog,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { type AppDictionary, uiText } from "@/lib/i18n";
import {
  getPasswordRequirementResults,
  isPasswordValid,
  type PasswordRequirementId,
} from "@/lib/password-policy";
import styles from "./setup-wizard.module.css";

type AccountForm = {
  confirmPassword: string;
  email: string;
  fullName: string;
  password: string;
};

type ApiKeysForm = {
  kakaoMobilityRestApiKey: string;
  kakaoRestApiKey: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
  publicDataApiKey: string;
  seoulOpenApiKey: string;
  vworldApiKey: string;
};

type EnvironmentCheck = {
  detail: string;
  id: string;
  ok: boolean;
  title: string;
};

type StatusPayload = {
  environment: {
    checks: EnvironmentCheck[];
    databaseExists: boolean;
  };
  installed: boolean;
};

const steps = [
  { icon: Cloud, id: "start", label: "Start" },
  { icon: FileCheck2, id: "license", label: "Terms" },
  { icon: ServerCog, id: "environment", label: "Server check" },
  { icon: UserCog, id: "sudo", label: "Sudo account" },
  { icon: Users, id: "admin", label: "Admin account" },
  { icon: KeyRound, id: "api", label: "API keys" },
  { icon: Database, id: "finish", label: "Database" },
] as const;

const initialAccount: AccountForm = {
  confirmPassword: "",
  email: "",
  fullName: "",
  password: "",
};

const initialApiKeys: ApiKeysForm = {
  kakaoMobilityRestApiKey: "",
  kakaoRestApiKey: "",
  openaiApiKey: "",
  openaiBaseUrl: "https://api.openai.com/v1",
  publicDataApiKey: "",
  seoulOpenApiKey: "",
  vworldApiKey: "",
};

const passwordRequirementLabelKeys: Record<PasswordRequirementId, string> = {
  length: "password.requirement.length",
  lowercase: "password.requirement.lowercase",
  number: "password.requirement.number",
  symbol: "password.requirement.symbol",
  uppercase: "password.requirement.uppercase",
};

function validateAccount(account: AccountForm) {
  if (!account.fullName.trim()) return "Full name is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email.trim())) {
    return "A valid email address is required.";
  }
  if (!isPasswordValid(account.password)) {
    return "Password must be at least 12 characters and include lowercase, uppercase, number, and special characters.";
  }
  if (account.password !== account.confirmPassword) {
    return "Passwords do not match.";
  }
  return null;
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  const generatedId = useId();
  const childId =
    isValidElement<{ id?: string }>(children) && children.props.id
      ? children.props.id
      : generatedId;
  const control = isValidElement<{ id?: string }>(children)
    ? cloneElement(children, { id: childId })
    : children;

  return (
    <label className={styles.field} htmlFor={childId}>
      <span>{label}</span>
      {control}
    </label>
  );
}

export function SetupWizard({ dictionary }: { dictionary: AppDictionary }) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [sudo, setSudo] = useState<AccountForm>(initialAccount);
  const [admin, setAdmin] = useState<AccountForm>(initialAccount);
  const [apiKeys, setApiKeys] = useState<ApiKeysForm>(initialApiKeys);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [apiTested, setApiTested] = useState(false);
  const [apiTestMessage, setApiTestMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const activeStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  useEffect(() => {
    let isDisposed = false;

    setIsHydrated(true);

    fetch("/api/setup/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: StatusPayload) => {
        if (!isDisposed) {
          setStatus(payload);
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
  }, []);

  const stepError = useMemo(() => {
    if (activeStep.id === "license" && !acceptedTerms) {
      return "Accept the terms to continue.";
    }
    if (activeStep.id === "sudo") {
      return validateAccount(sudo);
    }
    if (activeStep.id === "admin") {
      return validateAccount(admin);
    }
    if (activeStep.id === "api" && !apiTested) {
      return "Test the API key configuration before continuing.";
    }
    return null;
  }, [acceptedTerms, activeStep.id, admin, apiTested, sudo]);

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
      const payload = (await response.json()) as {
        error?: string;
        ok?: boolean;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "API key check failed.");
      }

      setApiTested(true);
      setApiTestMessage("API key configuration is ready to save.");
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

  async function completeInstallation() {
    setIsBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/setup/complete", {
        body: JSON.stringify({
          admin,
          apiKeys,
          licenseAccepted: acceptedTerms,
          sudo,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        ok?: boolean;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Installation failed.");
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
      setError(stepError);
      return;
    }

    if (isLastStep) {
      void completeInstallation();
      return;
    }

    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell} aria-label="Platelets setup wizard">
        <aside className={styles.sidebar}>
          <div className={styles.brand}>
            <span className={styles.logo}>
              <Cloud aria-hidden="true" size={25} />
            </span>
            <div>
              <strong>Platelets</strong>
              <span>Setup Assistant</span>
            </div>
          </div>

          <ol className={styles.steps}>
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isDone = index < stepIndex;
              const isActive = index === stepIndex;

              return (
                <li
                  className={isActive ? styles.stepActive : styles.step}
                  key={step.id}
                >
                  <span className={isDone ? styles.stepDone : styles.stepMark}>
                    {isDone ? (
                      <Check aria-hidden="true" size={16} />
                    ) : (
                      <Icon aria-hidden="true" size={16} />
                    )}
                  </span>
                  <span>{step.label}</span>
                </li>
              );
            })}
          </ol>

          <span className={styles.stepCount}>
            Step {stepIndex + 1} of {steps.length}
          </span>
        </aside>

        <div className={styles.content}>
          <div className={styles.mainPanel}>
            <span className={styles.eyebrow}>
              STEP {stepIndex + 1} OF {steps.length}
            </span>

            {activeStep.id === "start" && (
              <>
                <h1>Welcome to Platelets</h1>
                <p className={styles.lead}>
                  Set up this self-hosted emergency response CMS before the map
                  becomes available.
                </p>
                <div className={styles.infoPanel}>
                  This assistant creates the local SQLite database, stores
                  operator credentials, and saves server-side API keys for this
                  deployment.
                </div>
              </>
            )}

            {activeStep.id === "license" && (
              <>
                <h1>License agreement</h1>
                <p className={styles.lead}>
                  Review and accept the terms before continuing.
                </p>
                <div className={styles.termsBox}>
                  <h2>1. Open source deployment</h2>
                  <p>
                    Platelets is intended for self-hosted public-safety data
                    operations. Keep provider API terms, attribution, and local
                    operating policies in force.
                  </p>
                  <h2>2. Data and model caveats</h2>
                  <p>
                    Emergency, map, AI, and public data outputs are operational
                    aids. They do not replace official dispatch, medical, or
                    emergency decisions.
                  </p>
                </div>
                <label className={styles.checkRow}>
                  <input
                    checked={acceptedTerms}
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                    type="checkbox"
                  />
                  I have read and accept the Platelets setup terms.
                </label>
              </>
            )}

            {activeStep.id === "environment" && (
              <>
                <h1>Server environment check</h1>
                <p className={styles.lead}>
                  Confirm the deployment can create and use the local database.
                </p>
                <div className={styles.checkList}>
                  {(status?.environment.checks ?? []).map((check) => (
                    <div className={styles.checkItem} key={check.id}>
                      <span className={styles.okMark}>
                        <Check aria-hidden="true" size={16} />
                      </span>
                      <div>
                        <strong>{check.title}</strong>
                        <p>{check.detail}</p>
                      </div>
                    </div>
                  ))}
                  {!status && (
                    <div className={styles.checkItem}>
                      <LoaderCircle aria-hidden="true" size={18} />
                      <div>
                        <strong>Checking server</strong>
                        <p>Reading runtime and filesystem status.</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {activeStep.id === "sudo" && (
              <AccountStep
                account={sudo}
                dictionary={dictionary}
                description="This developer/operator account controls setup, datasets, logs, schedules, and AI configuration."
                onChange={updateSudo}
                title="Create the sudo account"
              />
            )}

            {activeStep.id === "admin" && (
              <AccountStep
                account={admin}
                dictionary={dictionary}
                description="This user-facing administrator can access protected operational and AI workflows without sudo privileges."
                onChange={updateAdmin}
                title="Create the admin account"
              />
            )}

            {activeStep.id === "api" && (
              <>
                <h1>API keys</h1>
                <p className={styles.lead}>
                  Save provider keys for maps, public data, geocoding, routing,
                  Seoul citydata, and AI.
                </p>
                <div className={styles.grid}>
                  <Field label="VWorld API key">
                    <input
                      onChange={(event) =>
                        updateApiKeys({ vworldApiKey: event.target.value })
                      }
                      value={apiKeys.vworldApiKey}
                    />
                  </Field>
                  <Field label="Public data API key">
                    <input
                      onChange={(event) =>
                        updateApiKeys({ publicDataApiKey: event.target.value })
                      }
                      value={apiKeys.publicDataApiKey}
                    />
                  </Field>
                  <Field label="Kakao REST API key">
                    <input
                      onChange={(event) =>
                        updateApiKeys({ kakaoRestApiKey: event.target.value })
                      }
                      value={apiKeys.kakaoRestApiKey}
                    />
                  </Field>
                  <Field label="Kakao Mobility REST API key">
                    <input
                      onChange={(event) =>
                        updateApiKeys({
                          kakaoMobilityRestApiKey: event.target.value,
                        })
                      }
                      value={apiKeys.kakaoMobilityRestApiKey}
                    />
                  </Field>
                  <Field label="Seoul Open API key">
                    <input
                      onChange={(event) =>
                        updateApiKeys({ seoulOpenApiKey: event.target.value })
                      }
                      value={apiKeys.seoulOpenApiKey}
                    />
                  </Field>
                  <Field label="OpenAI API key">
                    <input
                      onChange={(event) =>
                        updateApiKeys({ openaiApiKey: event.target.value })
                      }
                      type="password"
                      value={apiKeys.openaiApiKey}
                    />
                  </Field>
                </div>
                <Field label="OpenAI base URL">
                  <input
                    onChange={(event) =>
                      updateApiKeys({ openaiBaseUrl: event.target.value })
                    }
                    value={apiKeys.openaiBaseUrl}
                  />
                </Field>
                <button
                  className={styles.secondaryButton}
                  disabled={!isHydrated || isBusy}
                  onClick={testApiKeys}
                  type="button"
                >
                  Test API keys
                </button>
                {apiTestMessage && (
                  <p className={styles.successText}>{apiTestMessage}</p>
                )}
              </>
            )}

            {activeStep.id === "finish" && (
              <>
                <h1>Create database</h1>
                <p className={styles.lead}>
                  Platelets will create the SQLite database, store the setup
                  configuration, and open the home map.
                </p>
                <div className={styles.infoPanel}>
                  The installer stores credential hashes, never plain passwords.
                  Existing environment variables remain valid as deployment
                  fallbacks.
                </div>
              </>
            )}

            {error && <p className={styles.errorText}>{error}</p>}
          </div>

          <footer className={styles.footer}>
            <button
              className={styles.backButton}
              disabled={!isHydrated || stepIndex === 0 || isBusy}
              onClick={() =>
                setStepIndex((current) => Math.max(0, current - 1))
              }
              type="button"
            >
              <ArrowLeft aria-hidden="true" size={17} /> Back
            </button>
            <button
              className={styles.primaryButton}
              disabled={!isHydrated || isBusy}
              onClick={goNext}
              type="button"
            >
              {isBusy ? (
                <LoaderCircle aria-hidden="true" size={17} />
              ) : isLastStep ? (
                <ShieldCheck aria-hidden="true" size={17} />
              ) : (
                <ArrowRight aria-hidden="true" size={17} />
              )}
              {isLastStep ? "Install" : "Continue"}
            </button>
          </footer>
        </div>
      </section>
    </main>
  );
}

function AccountStep({
  account,
  dictionary,
  description,
  onChange,
  title,
}: {
  account: AccountForm;
  dictionary: AppDictionary;
  description: string;
  onChange: (patch: Partial<AccountForm>) => void;
  title: string;
}) {
  const passwordRequirementsId = useId();

  return (
    <>
      <h1>{title}</h1>
      <p className={styles.lead}>{description}</p>
      <div className={styles.grid}>
        <Field label="Full name">
          <input
            autoComplete="name"
            onChange={(event) => onChange({ fullName: event.target.value })}
            value={account.fullName}
          />
        </Field>
        <Field label="Email address">
          <input
            autoComplete="email"
            onChange={(event) => onChange({ email: event.target.value })}
            type="email"
            value={account.email}
          />
        </Field>
      </div>
      <label className={styles.field} htmlFor={passwordRequirementsId}>
        <span>Password</span>
        <input
          autoComplete="new-password"
          aria-describedby={`${passwordRequirementsId}-requirements`}
          id={passwordRequirementsId}
          onChange={(event) => onChange({ password: event.target.value })}
          type="password"
          value={account.password}
        />
      </label>
      <PasswordRequirementList
        dictionary={dictionary}
        id={`${passwordRequirementsId}-requirements`}
        password={account.password}
      />
      <Field label="Confirm password">
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
  dictionary,
  id,
  password,
}: {
  dictionary: AppDictionary;
  id: string;
  password: string;
}) {
  const requirements = getPasswordRequirementResults(password);

  return (
    <output aria-live="polite" className={styles.passwordChecklist} id={id}>
      <span className={styles.passwordChecklistTitle}>
        {uiText(dictionary, "password.requirement.title")}
      </span>
      <ul>
        {requirements.map((requirement) => {
          const status = requirement.met
            ? uiText(dictionary, "password.requirement.met")
            : uiText(dictionary, "password.requirement.missing");

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
              <span>
                {uiText(
                  dictionary,
                  passwordRequirementLabelKeys[requirement.id],
                )}
              </span>
              <span className={styles.visuallyHidden}>{status}</span>
            </li>
          );
        })}
      </ul>
    </output>
  );
}
