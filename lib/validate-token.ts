import crypto from "crypto";
import { TOKEN_MAX_AGE } from "@/lib/security";

const SECRET = process.env.API_SECRET!;

export function validateBackendToken(
  id: string,
  mediaType: string,
  season: string,
  episode: string,
  path: string,
  ts: number,
  token: string,
) {
  if (!Number.isFinite(ts)) return false;

  const age = Date.now() - ts;

  if (age < 0 || age > TOKEN_MAX_AGE) return false;

  const payload =
    mediaType === "tv"
      ? [id, mediaType, season, episode, path, ts].join(":")
      : [id, mediaType, path, ts].join(":");

  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(payload)
    .digest("hex");

  return expected === token;
}
