import { timingSafeEqual } from "node:crypto";

export const AUTH_USER = "admin";

/** Checks an HTTP Basic Authorization header against CONSOLE_PASSWORD. Fails closed when it is unset. */
export function isAuthorized(header: string | null): boolean {
  const password = process.env.CONSOLE_PASSWORD;
  if (!password || !header?.startsWith("Basic ")) return false;

  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const expected = Buffer.from(`${AUTH_USER}:${password}`);
  const given = Buffer.from(decoded);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
