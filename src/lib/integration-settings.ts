import { getAppSetting, setAppSetting } from "@/lib/points-db";
import {
  type ProtectedSecret,
  protectSecret,
  revealSecret,
} from "@/lib/secret-box";

const SETTINGS_KEY = "integration-settings";
const MAX_WEBHOOKS = 5;

export type IntegrationSettings = {
  fireSafetyApiKey: string;
  incidentWebhookUrls: string[];
  itsOpenApiKey: string;
  webPushContact: string;
  webPushPrivateKey: string;
  webPushPublicKey: string;
};

type StoredIntegrationSettings = {
  fireSafetyApiKey?: ProtectedSecret;
  incidentWebhookUrls?: ProtectedSecret;
  itsOpenApiKey?: ProtectedSecret;
  webPushContact?: ProtectedSecret;
  webPushPrivateKey?: ProtectedSecret;
  webPushPublicKey?: ProtectedSecret;
};

export type IntegrationSettingsSummary = {
  fireSafetyApiKeyConfigured: boolean;
  incidentWebhookCount: number;
  itsOpenApiKeyConfigured: boolean;
  webPushConfigured: boolean;
};

export type IntegrationSettingsUpdate = Partial<
  Record<keyof IntegrationSettings, unknown>
> & {
  clear?: Array<keyof IntegrationSettings>;
};

const EMPTY_SETTINGS: IntegrationSettings = {
  fireSafetyApiKey: "",
  incidentWebhookUrls: [],
  itsOpenApiKey: "",
  webPushContact: "",
  webPushPrivateKey: "",
  webPushPublicKey: "",
};
const FIRE_SAFETY_ENV_KEYS = [
  "FIRE-SAFTY-API-KEY",
  "FIRE-SAFETY-API-KEY",
  "FIRE_SAFETY_API_KEY",
] as const;
const ITS_ENV_KEYS = ["ITS-API-KEY", "ITS_API_KEY"] as const;

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function normalizeWebhookUrls(value: unknown) {
  const values = Array.isArray(value)
    ? value
    : String(value ?? "").split(/[\n,]/);

  return values
    .map((item) => cleanText(item, 2_000))
    .filter(Boolean)
    .slice(0, MAX_WEBHOOKS)
    .map((item) => {
      const url = new URL(item);

      if (url.protocol !== "https:" || url.username || url.password) {
        throw new Error("Webhook addresses must use HTTPS.");
      }

      return url.toString();
    });
}

function normalizeWebPushContact(value: unknown) {
  const contact = cleanText(value, 500);

  if (!contact) {
    return "";
  }

  const url = new URL(contact);
  if (url.protocol !== "mailto:" && url.protocol !== "https:") {
    throw new Error("Web push contact must use mailto or HTTPS.");
  }

  return url.toString();
}

function firstEnvironmentValue(names: readonly string[]) {
  for (const name of names) {
    const value = cleanText(process.env[name], 2_000);

    if (value) {
      return value;
    }
  }

  return "";
}

function protectSettings(
  input: IntegrationSettings,
): StoredIntegrationSettings {
  return {
    fireSafetyApiKey: protectSecret(input.fireSafetyApiKey),
    incidentWebhookUrls: protectSecret(input.incidentWebhookUrls.join("\n")),
    itsOpenApiKey: protectSecret(input.itsOpenApiKey),
    webPushContact: protectSecret(input.webPushContact),
    webPushPrivateKey: protectSecret(input.webPushPrivateKey),
    webPushPublicKey: protectSecret(input.webPushPublicKey),
  };
}

function revealSettings(input: StoredIntegrationSettings): IntegrationSettings {
  return {
    fireSafetyApiKey: revealSecret(input.fireSafetyApiKey ?? ""),
    incidentWebhookUrls: normalizeWebhookUrls(
      revealSecret(input.incidentWebhookUrls ?? ""),
    ),
    itsOpenApiKey: revealSecret(input.itsOpenApiKey ?? ""),
    webPushContact: revealSecret(input.webPushContact ?? ""),
    webPushPrivateKey: revealSecret(input.webPushPrivateKey ?? ""),
    webPushPublicKey: revealSecret(input.webPushPublicKey ?? ""),
  };
}

async function seedSettingsFromEnvironment(settings: IntegrationSettings) {
  const next = { ...settings };
  let changed = false;

  if (!next.fireSafetyApiKey) {
    next.fireSafetyApiKey = firstEnvironmentValue(FIRE_SAFETY_ENV_KEYS);
    changed = Boolean(next.fireSafetyApiKey);
  }

  if (!next.itsOpenApiKey) {
    next.itsOpenApiKey = firstEnvironmentValue(ITS_ENV_KEYS);
    changed = changed || Boolean(next.itsOpenApiKey);
  }

  if (changed) {
    await setAppSetting(SETTINGS_KEY, protectSettings(next));
  }

  return next;
}

export async function getIntegrationSettings() {
  const stored = await getAppSetting<StoredIntegrationSettings | null>(
    SETTINGS_KEY,
    null,
  );

  const settings = stored ? revealSettings(stored) : EMPTY_SETTINGS;

  return seedSettingsFromEnvironment(settings);
}

export function summarizeIntegrationSettings(
  settings: IntegrationSettings,
): IntegrationSettingsSummary {
  return {
    fireSafetyApiKeyConfigured: Boolean(settings.fireSafetyApiKey),
    incidentWebhookCount: settings.incidentWebhookUrls.length,
    itsOpenApiKeyConfigured: Boolean(settings.itsOpenApiKey),
    webPushConfigured: Boolean(
      settings.webPushContact &&
        settings.webPushPrivateKey &&
        settings.webPushPublicKey,
    ),
  };
}

export async function getIntegrationSettingsSummary() {
  return summarizeIntegrationSettings(await getIntegrationSettings());
}

export async function saveIntegrationSettings(
  input: IntegrationSettingsUpdate,
) {
  const current = await getIntegrationSettings();
  const clear = new Set(input.clear ?? []);
  const next = { ...current };
  const secretFields = [
    "fireSafetyApiKey",
    "itsOpenApiKey",
    "webPushPrivateKey",
    "webPushPublicKey",
  ] as const;

  for (const field of secretFields) {
    if (clear.has(field)) {
      next[field] = "";
      continue;
    }

    const value = cleanText(input[field], 2_000);
    if (value) {
      next[field] = value;
    }
  }

  if (clear.has("incidentWebhookUrls")) {
    next.incidentWebhookUrls = [];
  } else if (input.incidentWebhookUrls !== undefined) {
    const urls = normalizeWebhookUrls(input.incidentWebhookUrls);
    if (urls.length > 0) {
      next.incidentWebhookUrls = urls;
    }
  }

  if (clear.has("webPushContact")) {
    next.webPushContact = "";
  } else if (input.webPushContact !== undefined) {
    const contact = normalizeWebPushContact(input.webPushContact);
    if (contact) {
      next.webPushContact = contact;
    }
  }

  await setAppSetting(SETTINGS_KEY, protectSettings(next));
  return summarizeIntegrationSettings(next);
}
