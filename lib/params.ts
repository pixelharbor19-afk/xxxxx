// lib/params.ts  ← single source of truth, change here to rotate
import crypto from "crypto";
import { SALT } from "./salt";
// 🔁 Rotate these constants every few weeks

const FIELD_MAP = {
  id: "c81f42d9e22542643316f408",
  fToken: "9e3c7b134a3f457652481d0e493",
  ts: "54d8b2681fa337e260b1fd",
  token: "b7f18e34c225d63aef81c4a9",
  title: "2af9c71de33228480546391e",
  year: "f0b34e866a232909275a14f",
  season: "d41e8c26b592af575130fc48a7e",
  episode: "8b7d132fe6239c94541d8e7bc2",
  imdbId: "6e2af5c9734d219840b631a6d54",
  path: "7f4a91c63e285b917d4c2",
  mediaType: "a6e432c91f7385d204b17e",
  date: "3b91e7d42c685f3109a36d",
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
