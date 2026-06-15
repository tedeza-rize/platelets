import { lookup } from "node:dns/promises";
import webPush, { WebPushError } from "web-push";
import {
  deletePushSubscription,
  listPushSubscriptions,
  type StoredPushSubscription,
} from "@/lib/disaster-response/push-subscriptions";
import type { Incident } from "@/lib/disaster-response/types";
import { getDictionary, uiText } from "@/lib/i18n";
import { getIntegrationSettings } from "@/lib/integration-settings";

const MAX_WEBHOOKS = 5;
const WEBHOOK_TIMEOUT_MS = 5_000;

type AddressResolver = (
  hostname: string,
) => Promise<Array<{ address: string }>>;

type WebhookFetch = (
  input: string,
  init: RequestInit,
) => Promise<{ ok: boolean }>;

function isPrivateHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    normalized === "localhost" ||
    normalized === "metadata.google.internal" ||
    normalized === "169.254.169.254" ||
    normalized === "::1"
  ) {
    return true;
  }

  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");

  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    isPrivateHostname(normalized)
  );
}

export async function configuredIncidentWebhookUrls() {
  return (await getIntegrationSettings()).incidentWebhookUrls.slice(
    0,
    MAX_WEBHOOKS,
  );
}

export async function assertWebhookUrlSafe(
  value: string,
  resolveAddresses: AddressResolver = (hostname) =>
    lookup(hostname, { all: true }),
) {
  const url = new URL(value);

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    isPrivateHostname(url.hostname)
  ) {
    throw new Error("unsafe-webhook-url");
  }

  const addresses = await resolveAddresses(url.hostname);
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateAddress(address))
  ) {
    throw new Error("unsafe-webhook-address");
  }

  return url.toString();
}

function webhookBody(url: URL, incident: Incident) {
  const dictionary = getDictionary("ko");
  const text = uiText(dictionary, "notification.incident.webhook", {
    address: incident.address,
    title: incident.title,
  });

  return isHostnameOrSubdomain(url.hostname, "discord.com") ||
    isHostnameOrSubdomain(url.hostname, "discordapp.com")
    ? { content: text }
    : { text };
}

function isHostnameOrSubdomain(hostname: string, domain: string) {
  const normalized = hostname.toLowerCase();
  const normalizedDomain = domain.toLowerCase();

  return (
    normalized === normalizedDomain ||
    normalized.endsWith(`.${normalizedDomain}`)
  );
}

export async function sendIncidentWebhooks(
  incident: Incident,
  urls?: string[],
  dependencies: {
    fetcher?: WebhookFetch;
    resolveAddresses?: AddressResolver;
  } = {},
) {
  const fetcher = dependencies.fetcher ?? fetch;
  const configuredUrls = urls ?? (await configuredIncidentWebhookUrls());
  const results = await Promise.allSettled(
    configuredUrls.slice(0, MAX_WEBHOOKS).map(async (value) => {
      const safeUrl = await assertWebhookUrlSafe(
        value,
        dependencies.resolveAddresses,
      );
      const response = await fetcher(safeUrl, {
        body: JSON.stringify(webhookBody(new URL(safeUrl), incident)),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });

      if (!response.ok) throw new Error("webhook-delivery-failed");
    }),
  );

  return results.filter((result) => result.status === "fulfilled").length;
}

function pushPayload(incident: Incident, subscription: StoredPushSubscription) {
  const dictionary = getDictionary(subscription.locale);

  return JSON.stringify({
    body: uiText(dictionary, "notification.incident.body", {
      address: incident.address,
      title: incident.title,
    }),
    data: { url: "/incidents" },
    tag: `incident-${incident.id}`,
    title: uiText(dictionary, "notification.incident.title"),
  });
}

export async function getWebPushConfig() {
  const settings = await getIntegrationSettings();
  const publicKey = settings.webPushPublicKey;
  const privateKey = settings.webPushPrivateKey;
  const subject = settings.webPushContact;

  return {
    enabled: Boolean(publicKey && privateKey && subject),
    privateKey,
    publicKey,
    subject,
  };
}

export async function sendIncidentPushNotifications(incident: Incident) {
  const config = await getWebPushConfig();
  if (!config.enabled) return 0;

  const subscriptions = await listPushSubscriptions();
  const results = await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          subscription,
          pushPayload(incident, subscription),
          {
            TTL: 300,
            timeout: WEBHOOK_TIMEOUT_MS,
            urgency: "high",
            vapidDetails: {
              privateKey: config.privateKey,
              publicKey: config.publicKey,
              subject: config.subject,
            },
          },
        );
      } catch (error) {
        if (
          error instanceof WebPushError &&
          (error.statusCode === 404 || error.statusCode === 410)
        ) {
          await deletePushSubscription(subscription.endpoint);
          return;
        }
        throw error;
      }
    }),
  );

  return results.filter((result) => result.status === "fulfilled").length;
}

export async function dispatchIncidentAlerts(incident: Incident) {
  if (incident.riskLevel !== "high") return;

  await Promise.allSettled([
    sendIncidentPushNotifications(incident),
    sendIncidentWebhooks(incident),
  ]);
}
