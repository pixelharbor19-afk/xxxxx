// lib/params.ts  ← single source of truth, change here to rotate
import crypto from "crypto";
import { SALT } from "./salt";
// 🔁 Rotate these constants every few weeks

const FIELD_MAP = {
  id: "c81f42d9e225426413316f408",
  fToken: "9e3c7b134a3f4157652481d0e493",
  ts: "54d8b26181fa337e260b1fd",
  token: "b7f118e34c225d63aef81c4a9",
  title: "2af19c71de33228480546391e",
  year: "f0b34e866a232909215a14f",
  season: "d41e8c26b592af575130f1c48a7e",
  episode: "8b7d1132fe6239c94541d8e7bc2",
  imdbId: "6e2af5c97234d219840b631a6d54",
  path: "7f4a913c63e285b917d4c2",
  mediaType: "a6e432c914f7385d204b17e",
  date: "3b91e7d42c685f53109a36d",
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
