/**
 * App-level configuration sourced from public env vars (baked at build time by
 * Next). Keeps the escalation contact out of the component tree so it can be
 * set per deployment instead of hardcoded. Falls back to safe placeholders so
 * the UI still renders in local dev.
 */
export const escalation = {
  whatsapp: process.env.NEXT_PUBLIC_ESCALATION_WHATSAPP || "+62 812-0000-0000",
  email: process.env.NEXT_PUBLIC_ESCALATION_EMAIL || "hr-it@bcalife.co.id",
};
