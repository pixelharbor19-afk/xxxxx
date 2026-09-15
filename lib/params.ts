// lib/params.ts  ← single source of truth, change here to rotate
import crypto from "crypto";
import { SALT } from "./salt";
// 🔁 Rotate these constants every few weeks

const FIELD_MAP = {
  id: "a7f39c821d604e14323f36157b",
  fToken: "e83c4b7192d8f34323605479c1635a",
  ts: "61d9a5274c8e29af7054638c291e6",
  token: "c492f7a1d650291e4746c538a716d",
  title: "5e28c914a306d53185362f3674b392a1",
  year: "b731e6c9082a13975908f8341c306e",
  season: "d84279ce3018af95700c3613e85b",
  episode: "91c4a728d531f7850c92346b713d",
  imdbId: "f35c19d640365e871c784933a725f",
  path: "6b491e753d8fd392e75671a9384c",
  mediaType: "c2891a06d281e9477a35632e816b",
  date: "e164932582ad739e5814b73027",
  latestDate: "e54356416ad7397e5814b3027",
} as const;

export { FIELD_MAP };

export function generateFrontendToken(id: string) {
  const rt = Date.now();
  // 🔁 Rotate: swap order, add SALT, change hash algo to sha512 truncated
  const xt = crypto
    .createHash("sha512")
    .update(`${rt}:${SALT}:${id}`) // was: `${id}:${ts}`
    .digest("hex")
    .slice(0, 64); // truncate to 64 chars

  return { xt, rt }; // was: { f_token, f_ts }
}
