const FALLBACK_PATH = "/protected";

export function safeRedirectPath(
  value: string | null | undefined,
  fallback = FALLBACK_PATH,
): string {
  if (
    !value ||
    /[\\\u0000-\u001f\u007f]/.test(value) ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return fallback;
  }

  return value;
}

export function callbackUrl(origin: string, next: string | null | undefined): string {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", safeRedirectPath(next));
  return url.toString();
}
