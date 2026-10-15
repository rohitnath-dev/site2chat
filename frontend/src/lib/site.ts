/** Public contact details may be overridden for a deployment. */
const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const email = clean(import.meta.env.VITE_SUPPORT_EMAIL);
const defaultSupportEmail = "rohitnath49195@gmail.com";

export const SUPPORT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : defaultSupportEmail;
export const OPERATOR_NAME = clean(import.meta.env.VITE_OPERATOR_NAME);
