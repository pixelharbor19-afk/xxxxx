import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const mediaType = req.nextUrl.searchParams.get("mediaType");
  const se = req.nextUrl.searchParams.get("se");
  const ep = req.nextUrl.searchParams.get("ep");
  const viewKey = "FRjSMvzzHjJUp110I80zD_ERoJKzOgVg9rkuTxobBjY";

  if (!id || !viewKey || !mediaType) {
    return NextResponse.json(
      { success: false, error: "Missing params" },
      { status: 400 },
    );
  }

  const url = `https://vimeus.com/e/${mediaType === "tv" ? "serie" : "movie"}?tmdb=${encodeURIComponent(
    id,
  )}&view_key=${encodeURIComponent(viewKey)}${mediaType === "tv" ? `&se=1&ep=1` : ""}`;

  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Origin: "https://vimeus.com",
      Referer: "https://vimeus.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      {
        success: false,
        error: `Upstream returned ${response.status}`,
      },
      { status: response.status },
    );
  }

  const html = await response.text();

  const match = html.match(
    /<script[^>]*id=["']data["'][^>]*>\s*([\s\S]*?)\s*<\/script>/i,
  );

  if (!match) {
    return NextResponse.json(
      { success: false, error: "Data script not found" },
      { status: 404 },
    );
  }

  let data;

  try {
    data = JSON.parse(match[1]);
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to parse JSON" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    embeds: data.embeds ?? [],
  });
}
