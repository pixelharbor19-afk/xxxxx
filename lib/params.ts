// lib/params.ts  ← single source of truth, change here to rotate
import crypto from "crypto";
import { SALT } from "./salt";
// 🔁 Rotate these constants every few weeks

const FIELD_MAP = {
  id: "c81f43316f408",
  fToken: "9e3c7b13f41573652481d0e493",
  ts: "54d8b2618337e260b13fd",
  token: "b7f134c225d63aef381c4a9",
  title: "2af19de332284805436391e",
  year: "f0b34866a232909215a134f",
  season: "d41e6b592af5751330f1c48a7e",
  episode: "8b7d2fe6239c945341d8e7bc2",
  imdbId: "6e5c97234d2198403b631a6d54",
  path: "7f4a13c63e285b917d4c32",
  mediaType: "a632c914f73853d204b17e",
  date: "3b9142c685f53109a3336d",
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
