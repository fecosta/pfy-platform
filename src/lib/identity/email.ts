/**
 * PFY email identity normalization: trim surrounding whitespace and lowercase.
 * Provider-specific aliases such as Gmail dot/plus handling are not applied.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
