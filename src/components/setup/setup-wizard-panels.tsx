import { LoaderCircle } from "lucide-react";
import {
  formatSetupText,
  type SetupDictionary,
  type SetupDictionaryKey,
} from "@/lib/setup-i18n";
import styles from "./setup-wizard-content.module.scss";
import { EnvironmentCheckMark, Field } from "./setup-wizard-controls";
import {
  type ApiKeysForm,
  type CheckTextValues,
  type DatabaseForm,
  databaseEngineOptions,
  type EnvironmentCheck,
  type StatusPayload,
} from "./setup-wizard-types";
import {
  getApiFieldErrors,
  getDatabaseFieldErrors,
} from "./setup-wizard-validation";

function checkText(
  copy: SetupDictionary,
  key: string,
  values: CheckTextValues = {},
) {
  return Object.hasOwn(copy, key)
    ? formatSetupText(copy, key as SetupDictionaryKey, values)
    : key;
}

export function SimpleSetupPanel({
  info,
  lead,
  title,
}: {
  info: string;
  lead: string;
  title: string;
}) {
  return (
    <>
      <h1>{title}</h1>
      <p className={styles.lead}>{lead}</p>
      <div className={styles.infoPanel}>{info}</div>
    </>
  );
}

export function LicenseStep({
  acceptedTerms,
  copy,
  onAcceptedTermsChange,
}: {
  acceptedTerms: boolean;
  copy: SetupDictionary;
  onAcceptedTermsChange: (accepted: boolean) => void;
}) {
  return (
    <>
      <h1>{copy["license.title"]}</h1>
      <p className={styles.lead}>{copy["license.lead"]}</p>
      <div className={styles.termsBox}>
        <h2>{copy["license.section1.title"]}</h2>
        <p>{copy["license.section1.body"]}</p>
        <h2>{copy["license.section2.title"]}</h2>
        <p>{copy["license.section2.body"]}</p>
      </div>
      <label className={styles.checkRow}>
        <input
          checked={acceptedTerms}
          onChange={(event) => onAcceptedTermsChange(event.target.checked)}
          type="checkbox"
        />
        {copy["license.accept"]}
      </label>
    </>
  );
}

export function EnvironmentStep({
  copy,
  database,
  databaseNeedsTest,
  databaseTestMessage,
  isBusy,
  isDeletingDatabase,
  isHydrated,
  onDatabaseChange,
  onDatabaseDelete,
  onDatabaseTest,
  showValidation,
  status,
  visibleEnvironmentChecks,
}: {
  copy: SetupDictionary;
  database: DatabaseForm;
  databaseNeedsTest: boolean;
  databaseTestMessage: string | null;
  isBusy: boolean;
  isDeletingDatabase: boolean;
  isHydrated: boolean;
  onDatabaseChange: (patch: Partial<DatabaseForm>) => void;
  onDatabaseDelete: () => void;
  onDatabaseTest: () => void;
  showValidation: boolean;
  status: StatusPayload | null;
  visibleEnvironmentChecks: EnvironmentCheck[];
}) {
  return (
    <>
      <h1>{copy["environment.title"]}</h1>
      <p className={styles.lead}>{copy["environment.lead"]}</p>
      <div className={styles.checkList}>
        {visibleEnvironmentChecks.map((check) => (
          <EnvironmentCheckItem
            check={check}
            copy={copy}
            isBusy={isBusy}
            isDeletingDatabase={isDeletingDatabase}
            isHydrated={isHydrated}
            key={check.id}
            onDatabaseDelete={onDatabaseDelete}
            status={status}
          />
        ))}
        {!status && <PendingEnvironmentCheck copy={copy} />}
      </div>
      <section className={styles.databasePanel}>
        <h2>{copy["database.title"]}</h2>
        <fieldset className={styles.databaseOptions}>
          <legend>{copy["database.field.engine"]}</legend>
          {databaseEngineOptions.map((engine) => (
            <button
              aria-pressed={database.engine === engine}
              disabled={isBusy}
              key={engine}
              onClick={() => onDatabaseChange({ engine })}
              type="button"
            >
              {copy[`database.engine.${engine}` as SetupDictionaryKey]}
            </button>
          ))}
        </fieldset>
        {database.engine !== "sqlite" && (
          <Field
            error={
              showValidation || database.connectionString
                ? getDatabaseFieldErrors(database, copy).connectionString
                : undefined
            }
            label={copy["database.connectionString"]}
          >
            <input
              autoComplete="off"
              onChange={(event) =>
                onDatabaseChange({ connectionString: event.target.value })
              }
              type="password"
              value={database.connectionString}
            />
          </Field>
        )}
        {database.engine !== "sqlite" && (
          <p className={styles.helpText}>
            {copy["database.connectionStringHelp"]}
          </p>
        )}
        {databaseNeedsTest ? (
          <button
            className={styles.secondaryButton}
            disabled={!isHydrated || isBusy}
            onClick={onDatabaseTest}
            type="button"
          >
            {isBusy ? copy["database.testing"] : copy["database.test"]}
          </button>
        ) : null}
        {databaseTestMessage ? (
          <p className={styles.successText}>{databaseTestMessage}</p>
        ) : null}
      </section>
    </>
  );
}

function EnvironmentCheckItem({
  check,
  copy,
  isBusy,
  isDeletingDatabase,
  isHydrated,
  onDatabaseDelete,
  status,
}: {
  check: EnvironmentCheck;
  copy: SetupDictionary;
  isBusy: boolean;
  isDeletingDatabase: boolean;
  isHydrated: boolean;
  onDatabaseDelete: () => void;
  status: StatusPayload | null;
}) {
  const isPending = check.detailKey === "environment.clock.pending";

  return (
    <div
      className={`${styles.checkItem} ${
        check.ok || isPending ? "" : styles.checkItemFailed
      }`}
    >
      <EnvironmentCheckMark ok={check.ok} pending={isPending} />
      <div>
        <strong>{checkText(copy, check.titleKey)}</strong>
        <p>{checkText(copy, check.detailKey, check.detailValues)}</p>
        {check.id === "sqlite" &&
          status?.environment.databaseExists &&
          status?.environment.databaseCanDelete && (
            <button
              className={styles.checkActionButton}
              disabled={!isHydrated || isBusy}
              onClick={onDatabaseDelete}
              type="button"
            >
              {isDeletingDatabase
                ? copy["environment.sqlite.deleting"]
                : copy["environment.sqlite.delete"]}
            </button>
          )}
      </div>
    </div>
  );
}

function PendingEnvironmentCheck({ copy }: { copy: SetupDictionary }) {
  return (
    <div className={styles.checkItem}>
      <LoaderCircle aria-hidden="true" size={18} />
      <div>
        <strong>{copy["environment.checking.title"]}</strong>
        <p>{copy["environment.checking.detail"]}</p>
      </div>
    </div>
  );
}

export function ApiStep({
  apiKeys,
  apiTestMessage,
  copy,
  isBusy,
  isHydrated,
  onApiKeysChange,
  onApiTest,
  showValidation,
}: {
  apiKeys: ApiKeysForm;
  apiTestMessage: string | null;
  copy: SetupDictionary;
  isBusy: boolean;
  isHydrated: boolean;
  onApiKeysChange: (patch: Partial<ApiKeysForm>) => void;
  onApiTest: () => void;
  showValidation: boolean;
}) {
  return (
    <>
      <h1>{copy["api.title"]}</h1>
      <p className={styles.lead}>{copy["api.lead"]}</p>
      <div className={styles.grid}>
        <Field label={copy["field.vworldApiKey"]}>
          <input
            onChange={(event) =>
              onApiKeysChange({ vworldApiKey: event.target.value })
            }
            value={apiKeys.vworldApiKey}
          />
        </Field>
        <Field label={copy["field.publicDataApiKey"]}>
          <input
            onChange={(event) =>
              onApiKeysChange({ publicDataApiKey: event.target.value })
            }
            value={apiKeys.publicDataApiKey}
          />
        </Field>
        <Field label={copy["field.kakaoRestApiKey"]}>
          <input
            onChange={(event) =>
              onApiKeysChange({ kakaoRestApiKey: event.target.value })
            }
            value={apiKeys.kakaoRestApiKey}
          />
        </Field>
        <Field label={copy["field.kakaoMobilityRestApiKey"]}>
          <input
            onChange={(event) =>
              onApiKeysChange({
                kakaoMobilityRestApiKey: event.target.value,
              })
            }
            value={apiKeys.kakaoMobilityRestApiKey}
          />
        </Field>
        <Field label={copy["field.seoulOpenApiKey"]}>
          <input
            onChange={(event) =>
              onApiKeysChange({ seoulOpenApiKey: event.target.value })
            }
            value={apiKeys.seoulOpenApiKey}
          />
        </Field>
        <Field label={copy["field.openaiApiKey"]}>
          <input
            onChange={(event) =>
              onApiKeysChange({ openaiApiKey: event.target.value })
            }
            type="password"
            value={apiKeys.openaiApiKey}
          />
        </Field>
      </div>
      <Field
        error={
          showValidation || apiKeys.openaiBaseUrl
            ? getApiFieldErrors(apiKeys, copy).openaiBaseUrl
            : undefined
        }
        label={copy["field.openaiBaseUrl"]}
      >
        <input
          onChange={(event) =>
            onApiKeysChange({ openaiBaseUrl: event.target.value })
          }
          value={apiKeys.openaiBaseUrl}
        />
      </Field>
      <button
        className={styles.secondaryButton}
        disabled={!isHydrated || isBusy}
        onClick={onApiTest}
        type="button"
      >
        {copy["api.test"]}
      </button>
      {apiTestMessage ? (
        <p className={styles.successText}>{apiTestMessage}</p>
      ) : null}
    </>
  );
}
