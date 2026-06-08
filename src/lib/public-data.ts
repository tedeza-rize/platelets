export function getPublicDataApiKey() {
  const key =
    process.env.PUBLIC_DATA_API_KEY ??
    process.env.DATA_GO_KR_API_KEY ??
    process.env.DATA_GO_KR_SERVICE_KEY ??
    null;

  if (!key) {
    return null;
  }

  try {
    return key.includes("%") ? decodeURIComponent(key) : key;
  } catch {
    return key;
  }
}
