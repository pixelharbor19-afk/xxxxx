export function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 5000,
) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeout),
  });
}
