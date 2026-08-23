/**
 * Server-side allowlist for administrator access.
 * This list is never returned to clients.
 */
export const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.toLowerCase().trim())
    .filter(Boolean),
);

export function isAdmin(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.has(email.toLowerCase().trim());
}