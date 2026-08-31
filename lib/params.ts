// lib/params.ts  ← single source of truth, change here to rotate
import crypto from "crypto";
import { SALT } from "./salt";
// 🔁 Rotate these constants every few weeks

const FIELD_MAP = {
  id: "a7f39c821d604e5b1438f36e1547b",
  fToken: "e83c4b719a2d8f31e36052479c1635a",
  ts: "61d9a5274c8e329af750d6384c291e6",
  token: "c492f7a18d6502b91e7436c538a716d",
  title: "5e28c914a306d531e829f3674b392a1",
  year: "b731e6c9f082a1639d725f8341c306e",
  season: "d842759ce306184a2f957c3613e85b",
  episode: "91ce4a728bd503d1f785c92346b713d",
  imdbId: "f358c19d6740b3265e871c4933a725f",
  path: "6b491e7253ad80f4d392e7561a9384c",
  mediaType: "c285f914a306d281e947a35632e816b",
  date: "e164932c508f26ad739e5814b3027",
  latestDate: "e16493c54356416ad739e5814b3027",
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
