import { createDecipheriv, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

type SecretBox = {
  ciphertext: string;
  iv: string;
  tag: string;
  type: "platelets-secret-box";
  version: 1;
};

type StoredSetupState = {
  apiKeys?: {
    kakaoRestApiKey?: SecretBox | string;
    vworldApiKey?: SecretBox | string;
  };
};

type StoredIntegrationSettings = {
  fireSafetyApiKey?: SecretBox | string;
  itsOpenApiKey?: SecretBox | string;
};

function isSecretBox(value: unknown): value is SecretBox {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Partial<SecretBox>).type === "platelets-secret-box" &&
    (value as Partial<SecretBox>).version === 1
  );
}

function revealSecret(value: SecretBox | string | undefined, secret: string) {
  if (!value || typeof value === "string") {
    return value?.trim() || null;
  }

  if (!isSecretBox(value)) {
    return null;
  }

  const key = createHash("sha256").update(secret).digest();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(value.iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(value.tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64url")),
    decipher.final(),
  ])
    .toString("utf8")
    .trim();
}

export function loadMcpRuntimeApiKeys(
  databasePath: string,
  dataDirectory: string,
) {
  const database = new Database(databasePath, {
    fileMustExist: true,
    readonly: true,
  });

  try {
    const row = database
      .prepare("SELECT value_json FROM app_settings WHERE key = ?")
      .get("setup-state") as { value_json?: string } | undefined;
    const state = row?.value_json
      ? (JSON.parse(row.value_json) as StoredSetupState)
      : null;
    const integrationRow = database
      .prepare("SELECT value_json FROM app_settings WHERE key = ?")
      .get("integration-settings") as { value_json?: string } | undefined;
    const integrations = integrationRow?.value_json
      ? (JSON.parse(integrationRow.value_json) as StoredIntegrationSettings)
      : null;
    const secret = readFileSync(
      path.join(dataDirectory, ".platelets-secret-key"),
      "utf8",
    ).trim();

    return {
      fireSafetyApiKey: revealSecret(integrations?.fireSafetyApiKey, secret),
      itsOpenApiKey: revealSecret(integrations?.itsOpenApiKey, secret),
      kakaoRestApiKey: revealSecret(state?.apiKeys?.kakaoRestApiKey, secret),
      vworldApiKey: revealSecret(state?.apiKeys?.vworldApiKey, secret),
    };
  } finally {
    database.close();
  }
}
