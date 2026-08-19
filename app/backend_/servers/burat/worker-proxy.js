/**
 * DASH Proxy Worker (encrypted)
 *
 * GET /?data=...          ← { exp, base, cookie }
 * GET /{file}?data=...    ← segment / init
 */

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

async function encryptUrl(payload, cryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    new TextEncoder().encode(payload),
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
  if (!origin) return "*";
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const allowedOrigin = getCorsOrigin(request);
    if (allowedOrigin === null) {
      return new Response("Forbidden", { status: 403 });
    }

    const cors = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Expose-Headers":
        "Content-Length, Content-Range, Accept-Ranges",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const data = url.searchParams.get("data");
    if (!data) {
      return new Response("Missing data", { status: 400, headers: cors });
    }

    let payload;
    let cryptoKey;
    try {
      cryptoKey = await getCryptoKey(env.AES_KEY);
      payload = JSON.parse(await decryptUrl(data, cryptoKey));
    } catch {
      return new Response("Invalid token", { status: 403, headers: cors });
    }

    const { exp, base, cookie } = payload;

    if (!exp || Date.now() > exp) {
      return new Response("Token expired", { status: 403, headers: cors });
    }
    if (!base || !cookie) {
      return new Response("Invalid payload", { status: 400, headers: cors });
    }

    const file = url.pathname.slice(1);

    // Segment / init
    if (file) {
      const target = new URL(file, base);
      const response = await fetch(target, {
        method: request.method,
        headers: {
          Cookie: cookie,
          ...(request.headers.get("Range")
            ? { Range: request.headers.get("Range") }
            : {}),
        },
      });

      const headers = new Headers(cors);
      headers.set(
        "Content-Type",
        response.headers.get("Content-Type") || "application/octet-stream",
      );
      for (const h of ["Content-Length", "Content-Range", "Accept-Ranges"]) {
        const v = response.headers.get(h);
        if (v) headers.set(h, v);
      }

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    }

    // MPD
    const response = await fetch(new URL("index_web.mpd", base), {
      headers: { Cookie: cookie },
    });

    if (!response.ok) {
      return new Response(await response.text(), {
        status: response.status,
        headers: { ...cors, "Content-Type": "text/plain" },
      });
    }

    let mpd = await response.text();

    // Encrypt once, reuse for every segment URL
    const encrypted = await encryptUrl(
      JSON.stringify({ exp, base, cookie }),
      cryptoKey,
    );
    const dataParam = encodeURIComponent(encrypted);
    const origin = url.origin;

    mpd = mpd.replace(
      /(initialization|media)="([^"]+)"/g,
      (_, attr, path) => `${attr}="${origin}/${path}?data=${dataParam}"`,
    );

    return new Response(mpd, {
      headers: {
        ...cors,
        "Content-Type": "application/dash+xml",
        "Cache-Control": "no-store",
      },
    });
  },
};
