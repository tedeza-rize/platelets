const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

export function noStoreJson<TBody>(
  body: TBody,
  init: ResponseInit = {},
): Response {
  return Response.json(body, {
    ...init,
    headers: {
      ...NO_STORE_HEADERS,
      ...init.headers,
    },
  });
}
