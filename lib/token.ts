// lib/token.ts  ← single source of truth, change here to rotate
import crypto from "crypto";
import { SALT } from "./salt";
// 🔁 Rotate these constants every few weeks

const FIELD_MAP = {
  id: "c81f42d9e2532b16f408",
  fToken: "9e3c7b14af652481d0e49b73",
  ts: "54d8b21fa3754e60b1fd",
  token: "b7f18e4c225d963aef81c4a9",
  title: "2af9c71de384b546391e",
  year: "f0b34e8d66a9275a14f",
  season: "d41e8c6b259af57510fc48a7e",
  episode: "8b7d13fe620c94541d8e7bc2",
  imdbId: "6e2af5c97d19840b631a6d54",
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
