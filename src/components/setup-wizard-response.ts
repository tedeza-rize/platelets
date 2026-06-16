import type { SetupDictionary, SetupDictionaryKey } from "@/lib/setup-i18n";

type SetupErrorPayload = {
  errorKey?: string;
};

export async function readJsonResponse<TPayload>(
  response: Response,
  fallbackMessage: string,
) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(fallbackMessage);
  }

  try {
    return (await response.json()) as TPayload;
  } catch (error) {
    throw new Error(fallbackMessage, { cause: error });
  }
}

export function setupErrorMessage(
  payload: SetupErrorPayload,
  copy: SetupDictionary,
  fallbackKey: SetupDictionaryKey,
) {
  return payload.errorKey && Object.hasOwn(copy, payload.errorKey)
    ? copy[payload.errorKey as SetupDictionaryKey]
    : copy[fallbackKey];
}
