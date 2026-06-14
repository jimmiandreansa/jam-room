/** Authenticated fetch helper for API routes. */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit & { getAccessToken: () => Promise<string | null> },
): Promise<Response> {
  const { getAccessToken, headers, ...rest } = init;
  const token = await getAccessToken();
  const h = new Headers(headers);
  if (token) h.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...rest, headers: h });
}
