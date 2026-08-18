// lib/token.ts  ← single source of truth, change here to rotate
import crypto from "crypto";
import { SALT } from "./salt";
// 🔁 Rotate these constants every few weeks

const FIELD_MAP = {
  id: "c81f42d9e225464316f408",
  fToken: "9e3c7b134af457652481d0e493",
  ts: "54d8b2681fa37e60b1fd",
  token: "b7f18e4c225d63aef81c4a9",
  title: "2af9c71de328480546391e",
  year: "f0b34e866a2909275a14f",
  season: "d41e8c26b59af575100fc48a7e",
  episode: "8b7d132fe69c94541d8e7bc2",
  imdbId: "6e2af5c974d19840b631a6d54",
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
