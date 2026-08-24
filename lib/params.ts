// lib/params.ts  ← single source of truth, change here to rotate
import crypto from "crypto";
import { SALT } from "./salt";
// 🔁 Rotate these constants every few weeks

const FIELD_MAP = {
  id: "a7f39c821d604e5b92c7148f36e1547b",
  fToken: "e83c4b719a526d8f31e6052479c1635a",
  ts: "61d9a5274c8e3b219af750d684c291e6",
  token: "c492f7a183de6502b91e746c538a716d",
  title: "5e28c9147ab306d531e829f674b392a1",
  year: "b731e6c94f5082a1639d725f841c306e",
  season: "d8427b519ce306184a2f957c613e85b",
  episode: "91c6e4a728bd503d1f785c9246b713d",
  imdbId: "f35a8c219d6740b3265e871c493a725f",
  path: "6b491e7c253ad80f14d392e7561a984c",
  mediaType: "c7285f914ab306d281e947a5632e816b",
  date: "e1649b732c508f216ad739e5814b027",
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
