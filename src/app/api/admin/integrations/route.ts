import { requireAccessRole } from "@/lib/access-control";
import { noStoreJson } from "@/lib/http";
import {
  getIntegrationSettings,
  getIntegrationSettingsSummary,
  type IntegrationSettingsUpdate,
  saveIntegrationSettings,
} from "@/lib/integration-settings";
import {
  getApiKeyConfigurationSummary,
  getConfiguredApiKeys,
  type SetupApiKeys,
  saveConfiguredApiKeys,
} from "@/lib/setup-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const [, accessError] = await requireAccessRole(request, "sudo");
  if (accessError !== null) {
    return noStoreJson(
      { error: accessError.message },
      { status: accessError.code === "unauthorized" ? 401 : 403 },
    );
  }

  const rawApiKeys = await getConfiguredApiKeys();
  const rawIntegrations = await getIntegrationSettings();

  return noStoreJson({
    apiKeys: {
      ...(await getApiKeyConfigurationSummary()),
      raw: rawApiKeys,
    },
    integrations: {
      ...(await getIntegrationSettingsSummary()),
      raw: {
        itsOpenApiKey: rawIntegrations.itsOpenApiKey,
        incidentWebhookUrls: rawIntegrations.incidentWebhookUrls.join("\n"),
        webPushPublicKey: rawIntegrations.webPushPublicKey,
        webPushPrivateKey: rawIntegrations.webPushPrivateKey,
        webPushContact: rawIntegrations.webPushContact,
      },
    },
  });
}

export async function PUT(request: Request) {
  const [, accessError] = await requireAccessRole(request, "sudo");
  if (accessError !== null) {
    return noStoreJson(
      { error: accessError.message },
      { status: accessError.code === "unauthorized" ? 401 : 403 },
    );
  }

  const payload = (await request.json().catch(() => null)) as {
    apiKeys?: Partial<SetupApiKeys>;
    clearApiKeys?: Exclude<keyof SetupApiKeys, "openaiBaseUrl">[];
    integrations?: IntegrationSettingsUpdate;
  } | null;

  try {
    if (payload?.apiKeys || payload?.clearApiKeys) {
      await saveConfiguredApiKeys(
        payload.apiKeys ?? {},
        payload.clearApiKeys ?? [],
      );
    }

    if (payload?.integrations) {
      await saveIntegrationSettings(payload.integrations);
    }

    return noStoreJson({
      apiKeys: await getApiKeyConfigurationSummary(),
      integrations: await getIntegrationSettingsSummary(),
    });
  } catch {
    return noStoreJson(
      { errorKey: "integrationSettings.saveFailed" },
      { status: 400 },
    );
  }
}
