import { getRuntimeApiKeys } from "@/lib/runtime-config";

export async function getPublicDataApiKey() {
  const { publicDataApiKey } = await getRuntimeApiKeys();
  const key = publicDataApiKey || null;

  if (!key) {
    return null;
  }

  try {
    return key.includes("%") ? decodeURIComponent(key) : key;
  } catch {
    return key;
  }
}
