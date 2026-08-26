import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL_SUS!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_SUS!,
);

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  console.log(`[SCRAPING ROUTE NO EXIST] | IP: ${ip}`);

  try {
    const { data } = await supabase
      .from("suspicious_ips")
      .select("hits")
      .eq("ip", ip)
      .maybeSingle();

    if (data) {
      await supabase
        .from("suspicious_ips")
        .update({
          hits: data.hits + 1,
          last_seen: new Date().toISOString(),
        })
        .eq("ip", ip);
    } else {
      await supabase.from("suspicious_ips").insert({
        ip,
        hits: 1,
        asn: req.headers.get("cf-connecting-asn"),
        country: req.headers.get("cf-ipcountry"),
        method: req.method,
        path: req.nextUrl.pathname,
        user_agent: req.headers.get("user-agent"),
        referer: req.headers.get("referer"),
      });
    }
  } catch (err) {
    console.error("Failed to log suspicious IP:", err);
  }

  return new NextResponse(null, { status: 429 });
}
