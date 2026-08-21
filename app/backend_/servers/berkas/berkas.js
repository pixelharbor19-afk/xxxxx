function toBase64Url(bytes) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);

  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");

  while (str.length % 4) str += "=";

  const bin = atob(str);

  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function getCryptoKey(aesKey) {
  const keyBytes = Uint8Array.from(
    aesKey.match(/.{2}/g).map((b) => parseInt(b, 16)),
  );

  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encryptUrl(url, cryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    new TextEncoder().encode(url),
  );

  const out = new Uint8Array(iv.length + encrypted.byteLength);

  out.set(iv, 0);
  out.set(new Uint8Array(encrypted), iv.length);

  return toBase64Url(out);
}

async function decryptUrl(data, cryptoKey) {
  const bytes = fromBase64Url(data);

  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}

function getCorsOrigin(req) {
  const origin = req.headers.get("Origin");

  if (origin) {
    try {
      const hostname = new URL(origin).hostname;

      if (
        hostname.includes("localhost") ||
        hostname.includes("zxcstream") ||
        hostname.includes("zxcprime") ||
        hostname.includes("mnflix")
      ) {
        return origin;
      }
    } catch {}

    return null;
  }

  return null;
}

export default {
  async fetch(request, env) {
    const worker = new URL(request.url);

    if (worker.pathname === "/" && !worker.search) {
      return new Response("OK", { status: 200 });
    }

    const cryptoKey = await getCryptoKey(env.AES_KEY);

    const allowedOrigin = getCorsOrigin(request);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      if (!allowedOrigin) {
        return new Response("Forbidden", { status: 403 });
      }

      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "Range, Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const data = worker.searchParams.get("data");

    if (!data) {
      return new Response("Missing ?data=", { status: 400 });
    }

    let target;

    try {
      target = await decryptUrl(data, cryptoKey);
    } catch {
      return new Response("Invalid encrypted URL", { status: 403 });
    }

    const upstream = new URL(target);

    // Random IP ranges
    const ranges = [
      [41, 57],
      [41, 60],
      [41, 72],
      [41, 73],
      [41, 116],
      [41, 138],
      [41, 160],
      [41, 175],
      [41, 188],
      [41, 203],
      [41, 215],
      [41, 222],
      [102, 0],
      [102, 22],
      [102, 68],
      [102, 89],
      [102, 130],
      [102, 164],
      [102, 176],
      [102, 212],
      [105, 16],
      [105, 48],
      [105, 112],
      [105, 160],
      [105, 224],
      [197, 136],
      [197, 148],
      [197, 156],
      [197, 210],
      [197, 232],
      [197, 248],
      [45, 96],
      [45, 100],
      [45, 108],
    ];

    const base = ranges[Math.floor(Math.random() * ranges.length)];
    const rand = () => Math.floor(Math.random() * 254) + 1;
    const randomIP = `${base[0]}.${base[1]}.${rand()}.${rand()}`;

    const headers = new Headers({
      Origin: "https://nextgencloudfabric.com",
      Referer: "https://nextgencloudfabric.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.7",
      "Accept-Encoding": "identity;q=1, *;q=0",
      "X-Forwarded-For": randomIP,
      "CF-Connecting-IP": randomIP,
      "X-Real-IP": randomIP,
    });

    const clientRange = request.headers.get("Range");
    if (clientRange) {
      headers.set("Range", clientRange);
    }

    const response = await fetch(upstream, {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : request.body,
      redirect: "follow",
    });

    if (!response.ok && response.status !== 206) {
      return new Response(null, {
        status: response.status,
        headers: {
          ...(allowedOrigin && {
            "Access-Control-Allow-Origin": allowedOrigin,
          }),
          "Cache-Control": "no-store",
        },
      });
    }

    const contentType = response.headers.get("content-type") || "";

    // Rewrite .m3u8 playlists
    if (
      upstream.pathname.endsWith(".m3u8") ||
      contentType.includes("mpegurl")
    ) {
      const playlist = await response.text();

      const lines = playlist.split(/\r?\n/);
      const rewritten = [];

      for (const line of lines) {
        if (!line || line.startsWith("#")) {
          rewritten.push(line);
          continue;
        }

        const absolute = new URL(line, upstream).toString();
        const encrypted = await encryptUrl(absolute, cryptoKey);

        rewritten.push(
          `${worker.origin}/?data=${encodeURIComponent(encrypted)}`,
        );
      }

      const output = rewritten.join("\n");

      const out = new Headers({
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Expose-Headers": "*",
      });

      if (allowedOrigin) {
        out.set("Access-Control-Allow-Origin", allowedOrigin);
        out.set("Vary", "Origin");
      }

      return new Response(output, { status: response.status, headers: out });
    }

    // Proxy everything else (.ts, .m4s, .mp4, .key, etc.)
    const out = new Headers(response.headers);

    if (allowedOrigin) {
      out.set("Access-Control-Allow-Origin", allowedOrigin);
      out.set("Vary", "Origin");
    } else {
      out.delete("Access-Control-Allow-Origin");
    }

    out.set("Access-Control-Allow-Headers", "*");
    out.set("Access-Control-Expose-Headers", "*");
    out.set("Accept-Ranges", "bytes");

    return new Response(response.body, {
      status: response.status,
      headers: out,
    });
  },
};
