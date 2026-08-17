import { NextResponse } from "next/server";

const URL = "https://vimeos.net/embed-kfox00c86cwh.html";

export async function GET() {
  const response = await fetch(URL, {
    headers: {
      Pragma: "no-cache",
      "Cache-Control": "no-cache",
      "Sec-CH-UA": '"Not;A=Brand";v="8", "Chromium";v="150", "Brave";v="150"',
      "Sec-CH-UA-Mobile": "?0",
      "Sec-CH-UA-Platform": '"Windows"',
      "Upgrade-Insecure-Requests": "1",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Sec-GPC": "1",
      "Accept-Language": "en-US,en;q=0.8",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-User": "?1",
      "Sec-Fetch-Dest": "document",
      "Accept-Encoding": "identity",
      Cookie: "vid=304705508",
      Priority: "u=0, i",
    },
    cache: "no-store",
    redirect: "follow",
  });

  const html = await response.text();

  // 1) Direct match (works if the packed script is not heavily obfuscated on this response)
  let m3u8 = html.match(/https?:\/\/[^"'\\\s]+?\.m3u8[^"'\\\s]*/i)?.[0] ?? null;

  // 2) Fallback: unpack Dean-Edwards packer and pull sources[0].file
  if (!m3u8) {
    const packed = html.match(
      /eval\(function\(p,a,c,k,e,d\)\{while\(c--\)if\(k\[c\]\)p=p\.replace\(new RegExp\('\\\\b'\+c\.toString\(a\)\+'\\\\b','g'\),k\[c\]\);return p\}\('((?:\\'|[^'])*)',(\d+),(\d+),'((?:\\'|[^'])*)'\.split\('\|'\)\)\)/,
    );

    if (packed) {
      const [, p, aStr, cStr, kStr] = packed;
      const a = parseInt(aStr, 10);
      let c = parseInt(cStr, 10);
      const k = kStr.split("|");

      const toBase = (n: number, base: number) => {
        if (n === 0) return "0";
        const digits = "0123456789abcdefghijklmnopqrstuvwxyz";
        let s = "";
        while (n) {
          s = digits[n % base] + s;
          n = Math.floor(n / base);
        }
        return s;
      };

      let code = p;
      while (c--) {
        if (k[c]) {
          code = code.replace(
            new RegExp("\\b" + toBase(c, a) + "\\b", "g"),
            k[c],
          );
        }
      }

      m3u8 = code.match(/https?:\/\/[^"'\\\s]+?\.m3u8[^"'\\\s]*/i)?.[0] ?? null;
    }
  }

  if (!m3u8) {
    return NextResponse.json({ error: "m3u8 not found" }, { status: 404 });
  }

  // return NextResponse.json({ m3u8 });
  return NextResponse.json({
    success: true,
    links: [{ type: "hls", link: m3u8 }],
    subtitles: [],
  });
}
