/**
 * Combined Worker
 *
 * GET /scrape?slug=frankenstein-2025
 * GET /resolve?embed_url=https://...&h=...
 * GET /proxy?data=...          ← single encrypted payload: { exp, url, headers }
 */

const HOLLY_BASE = "https://hollymoviehd.cc";
const HOLLY_AJAX = `${HOLLY_BASE}/wp-admin/admin-ajax.php`;
const GOOD_BASE = "https://goodstream.cc";

const HOLLY_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function buildHollyUrl(slug) {
  const clean = slug.replace(/^\/|\/$/g, "");
  return /season-\d+-episode-\d+/i.test(clean)
    ? `${HOLLY_BASE}/episode/${clean}/`
    : `${HOLLY_BASE}/${clean}/`;
}

function getCorsOrigin(req) {
  const origin = req.headers.get("Origin");
  if (!origin) return "*"; // server-to-server, allow
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
  return null; // browser request from unknown origin, block
}

// ─── Crypto helpers ──────────────────────────────────────────────────────────

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

// ─── /resolve still uses the old separate "h" param ──────────────────────────

async function getHeaders(url, cryptoKey) {
  const raw = url.searchParams.get("h");
  if (!raw) return { error: 'Missing "h" param' };
  try {
    const decrypted = await decryptUrl(raw, cryptoKey);
    return { headers: JSON.parse(decrypted) };
  } catch {
    return { error: "Invalid headers token" };
  }
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleScrape(url) {
  const slug = url.searchParams.get("slug");
  if (!slug) return json({ error: 'Missing "slug"' }, 400);

  const pageUrl = buildHollyUrl(slug);
  const pageRes = await fetch(pageUrl, {
    headers: { ...HOLLY_HEADERS, Accept: "text/html,*/*;q=0.8" },
  });

  if (pageRes.status === 429) return json({ error: "Rate limited" }, 429);
  if (!pageRes.ok)
    return json({ error: `Page fetch failed: HTTP ${pageRes.status}` }, 502);

  const html = await pageRes.text();
  const streamkey = (html.match(/data-streamkey="([^"]+)"/) || [])[1] || null;
  const nonce = (html.match(/data-wpnonce="([^"]+)"/) || [])[1] || null;
  const imdbid = (html.match(/data-imdbid="(tt\d+)"/) || [])[1] || null;

  if (!streamkey) return json({ error: "streamkey not found" }, 404);
  if (!nonce) return json({ error: "nonce not found" }, 404);

  const ajaxRes = await fetch(HOLLY_AJAX, {
    method: "POST",
    headers: {
      ...HOLLY_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json, */*; q=0.01",
      Referer: pageUrl,
      Origin: HOLLY_BASE,
    },
    body: new URLSearchParams({
      action: "ajax_getlinkstream",
      streamkey,
      nonce,
      ...(imdbid ? { imdbid } : {}),
    }).toString(),
  });

  if (ajaxRes.status === 429) return json({ error: "Rate limited" }, 429);
  if (!ajaxRes.ok)
    return json({ error: `ajax POST failed: HTTP ${ajaxRes.status}` }, 502);

  let ajaxData;
  try {
    ajaxData = await ajaxRes.json();
  } catch {
    return json({ error: "ajax returned non-JSON" }, 502);
  }

  const qualities = Object.entries(ajaxData.servers_iframe || {}).map(
    ([name, embed_url]) => ({
      quality: name,
      embed_url,
    }),
  );

  return json({ slug, pageUrl, streamkey, nonce, imdbid, qualities });
}

async function handleResolve(url, cryptoKey) {
  const embedUrl = url.searchParams.get("embed_url");
  if (!embedUrl) return json({ error: 'Missing "embed_url"' }, 400);

  const { headers, error } = await getHeaders(url, cryptoKey);
  if (error) return json({ error }, 400);

  const fullEmbedUrl = embedUrl.startsWith("http")
    ? embedUrl
    : `${GOOD_BASE}${embedUrl}`;
  const embed = new URL(fullEmbedUrl);
  const embedId = embed.pathname.split("/").pop();
  const e = embed.searchParams.get("e");

  if (!embedId) return json({ error: "Could not extract embed ID" }, 400);

  const embedRes = await fetch(fullEmbedUrl, {
    headers: { ...headers, Accept: "text/html,*/*", Referer: fullEmbedUrl },
  });
  if (!embedRes.ok)
    return json(
      { error: `Embed page fetch failed: HTTP ${embedRes.status}` },
      502,
    );

  const embedHtml = await embedRes.text();
  const csrfToken =
    (embedHtml.match(/id="csrf_token"\s+value="([^"]+)"/) || [])[1] || null;
  if (!csrfToken)
    return json({ error: "csrf_token not found in embed page" }, 404);

  const sourceRes = await fetch(fullEmbedUrl, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json, */*; q=0.01",
      Referer: fullEmbedUrl,
    },
    body: new URLSearchParams({
      ...(e ? { e } : {}),
      token: csrfToken,
    }).toString(),
  });

  if (!sourceRes.ok)
    return json({ error: `Source POST failed: HTTP ${sourceRes.status}` }, 502);

  let sourceData;
  try {
    sourceData = await sourceRes.json();
  } catch {
    return json({ error: "Source returned non-JSON" }, 502);
  }

  if (!sourceData.success)
    return json({ error: "Source request unsuccessful", raw: sourceData }, 502);

  const sources = (sourceData.sources || []).map((s) => {
    let file = s.file;
    if (file.startsWith("//")) file = "https:" + file;
    else if (file.startsWith("/")) file = GOOD_BASE + file;
    return { label: s.label, type: s.type, file };
  });

  return json({ embed_id: embedId, csrf_token: csrfToken, sources });
}
async function handleProxy(url, request, cryptoKey) {
  const data = url.searchParams.get("data");
  if (!data) return json({ error: 'Missing "data" param' }, 400);

  let payload;
  try {
    const decoded = await decryptUrl(data, cryptoKey);
    payload = JSON.parse(decoded);
  } catch {
    return json({ error: "Invalid token" }, 403);
  }

  const { exp, url: targetUrl, headers } = payload;

  // Expiration check
  if (!exp || Date.now() > exp) {
    return json({ error: "Token expired" }, 403);
  }

  if (!targetUrl || typeof targetUrl !== "string") {
    return json({ error: "Invalid payload: missing url" }, 400);
  }

  if (!headers || typeof headers !== "object") {
    return json({ error: "Invalid payload: missing headers" }, 400);
  }

  const res = await fetch(targetUrl, {
    headers: {
      ...headers,
      ...(request.headers.get("Range")
        ? { Range: request.headers.get("Range") }
        : {}),
    },
  });

  if (!res.ok) {
    return new Response(res.body, {
      status: res.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        ...(res.headers.get("Content-Type")
          ? { "Content-Type": res.headers.get("Content-Type") }
          : {}),
      },
    });
  }

  const ct = res.headers.get("content-type") || "application/octet-stream";
  const isPlaylist =
    ct.includes("mpegurl") ||
    targetUrl.includes(".m3u8") ||
    targetUrl.includes("/pl/") ||
    targetUrl.includes("/streamsvr/");

  if (isPlaylist) {
    const base = new URL(targetUrl);
    const baseDir =
      base.origin +
      base.pathname.substring(0, base.pathname.lastIndexOf("/") + 1);

    const lines = await Promise.all(
      (await res.text()).split("\n").map(async (line) => {
        const t = line.trim();
        if (!t || t.startsWith("#")) return line;

        let abs = t;
        if (t.startsWith("//")) abs = "https:" + t;
        else if (t.startsWith("/")) abs = base.origin + t;
        else if (!t.startsWith("http")) abs = baseDir + t;

        const segmentPayload = JSON.stringify({
          exp, // reuse the playlist’s exp
          url: abs,
          headers,
        });

        const encrypted = await encryptUrl(segmentPayload, cryptoKey);
        return `${url.origin}/proxy?data=${encodeURIComponent(encrypted)}`;
      }),
    );

    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      },
    });
  }

  // Regular media (mp4 / segment)
  return new Response(res.body, {
    status: res.status,
    headers: {
      "Content-Type": ct,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache",
      ...(res.headers.get("Content-Length")
        ? { "Content-Length": res.headers.get("Content-Length") }
        : {}),
      ...(res.headers.get("Content-Range")
        ? { "Content-Range": res.headers.get("Content-Range") }
        : {}),
    },
  });
}
// ─── Entry ───────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const allowedOrigin = getCorsOrigin(request);

    if (allowedOrigin === null)
      return new Response("Forbidden", { status: 403 });

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    const cryptoKey = await getCryptoKey(env.AES_KEY);

    if (pathname === "/scrape") return handleScrape(url);
    if (pathname === "/resolve") return handleResolve(url, cryptoKey);
    if (pathname === "/proxy") return handleProxy(url, request, cryptoKey);

    return json({
      routes: {
        "/scrape?slug=...": "Holly scraper",
        "/resolve?embed_url=...&h=...": "Goodstream resolver",
        "/proxy?data=...": "Media proxy (payload: {exp,url,headers})",
      },
    });
  },
};
