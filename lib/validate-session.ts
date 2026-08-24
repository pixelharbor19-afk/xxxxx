import crypto from "crypto";
import { TOKEN_MAX_AGE } from "@/lib/token-age";

const SECRET = process.env.API_SECRET!;

export function validateSession(cookie: string) {
  const [value, ts, signature] = cookie.split(".");

  if (!value || !ts || !signature) return false;

  const timestamp = Number(ts);

  if (!Number.isFinite(timestamp)) return false;

  const age = Date.now() - timestamp;

  if (age < 0 || age > TOKEN_MAX_AGE) return false;

  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(`${value}:${ts}`)
    .digest("hex");

  return expected === signature;
}
