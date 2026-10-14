/**
 * Operator details that only the site owner can supply. Leave unset until real values exist: pages show a
 * visible "to be provided" marker instead of an invented name or address.
 *   VITE_SUPPORT_EMAIL  - public support address, e.g. support@your-domain
 *   VITE_OPERATOR_NAME  - legal name of the person or company operating Site2Chat
 */
const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const email = clean(import.meta.env.VITE_SUPPORT_EMAIL);

export const SUPPORT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
export const OPERATOR_NAME = clean(import.meta.env.VITE_OPERATOR_NAME);
