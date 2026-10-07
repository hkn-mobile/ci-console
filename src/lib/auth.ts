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

/** Download links in the QR code skip the password; they still need the company network. */
export const PUBLIC_DOWNLOAD_PREFIX = "/builds/file/";

/**
 * True for loopback and private (RFC 1918 / unique-local) addresses.
 *
 * Only a second line of defence: with no reverse proxy in front, a client can
 * send its own X-Forwarded-For. The real guard is that port 3100 is not
 * reachable from the Internet.
 */
export function isPrivateAddress(forwardedFor: string | null): boolean {
  const address = (forwardedFor ?? "").split(",")[0].trim().replace(/^::ffff:/, "");
  if (!address) return false;
  if (address === "::1" || /^(fc|fd)[0-9a-f]{2}:/i.test(address)) return true;
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
