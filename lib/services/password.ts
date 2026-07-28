import { scryptSync, timingSafeEqual } from "node:crypto";

export function verifyScryptPassword(
  password: string,
  encoded: string,
): boolean {
  const [algorithm, salt, expectedHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;

  try {
    const actual = scryptSync(password, salt, expectedHex.length / 2);
    const expected = Buffer.from(expectedHex, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
