import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ALLOWED_ORIGINS } from "@/lib/allowed-referers";
import { FIELD_MAP } from "@/lib/token";
import { SALT } from "@/lib/salt";

const SECRET = process.env.API_SECRET!;

function validateFrontendToken(xt: string, id: string, rt: number) {
  const expected = crypto
    .createHash("sha512")
    .update(`${rt}:${SALT}:${id}`) // must mirror generateFrontendToken
    .digest("hex")
    .slice(0, 64);

  return expected === xt && Date.now() - rt < 120000;
}

function generateBackendToken(xt: string, id: string) {
  const rt = Date.now();
  // 🔁 Rotate: include SALT in HMAC input
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(`${SALT}:${id}:${xt}:${rt}`) // was: `${id}:${f_token}:${ts}`
    .digest("hex");

  return { [FIELD_MAP.token]: sig, [FIELD_MAP.ts]: rt };
  // returns: { sig: "...", rt: 1234567890 }
}

const blockedIPs = ["45.86.86.43", "192.142.18.175"];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const id = body[FIELD_MAP.id]; // body.mid
  const xt = body[FIELD_MAP.fToken]; // body.xt
  const rt = body[FIELD_MAP.ts]; // body.rt

  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0] || "Unknown";
  const origin = req.headers.get("origin") || "";

  if (!ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }

  if (blockedIPs.includes(ip)) {
    // console.log("Blocked IP tried to access:", ip, ua);
    return new Response(null, { status: 403 });
  }

  if (!validateFrontendToken(xt, id, rt)) {
    return NextResponse.json(
      { error: "Blocked IP tried to access:" },
      { status: 422 },
    );
  }

  return NextResponse.json(generateBackendToken(xt, id));
}
// Bind HMAC token to IP — so even a stolen token is useless
