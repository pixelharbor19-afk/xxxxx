/**
 * Combined Worker
 *
 * GET /scrape?slug=frankenstein-2025
 * GET /resolve?embed_url=https://...&headers={...}
 * GET /proxy?url=https://...&headers={...}
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

function getHeaders(url) {
  const raw = url.searchParams.get("h");
  if (!raw) return { error: 'Missing "h" param' };
  try {
    return { headers: JSON.parse(raw) };
  } catch {
    return { error: "Invalid headers token" };
  }
}

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

async function handleResolve(url) {
  const embedUrl = url.searchParams.get("embed_url");
  if (!embedUrl) return json({ error: 'Missing "embed_url"' }, 400);

  const { headers, error } = getHeaders(url);
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

async function handleProxy(url, request) {
  const data = url.searchParams.get("data");
  if (!data) return json({ error: 'Missing "data" param' }, 400);

  const decoded = data;

  const { headers, error } = getHeaders(url);
  if (error) return json({ error }, 400);

  const res = await fetch(decoded, {
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
    decoded.includes(".m3u8") ||
    decoded.includes("/pl/") ||
    decoded.includes("/streamsvr/");

  if (isPlaylist) {
    const base = new URL(decoded);
    const baseDir =
      base.origin +
      base.pathname.substring(0, base.pathname.lastIndexOf("/") + 1);
    const h = url.searchParams.get("h");
    const lines = (await res.text()).split("\n").map((line) => {
      const t = line.trim();
      if (!t || t.startsWith("#")) return line;
      let abs = t;
      if (t.startsWith("//")) abs = "https:" + t;
      else if (t.startsWith("/")) abs = base.origin + t;
      else if (!t.startsWith("http")) abs = baseDir + t;
      return `${url.origin}/proxy?data=${encodeURIComponent(abs)}&h=${encodeURIComponent(h)}`;
    });

    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      },
    });
  }

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
    if (pathname === "/scrape") return handleScrape(url);
    if (pathname === "/resolve") return handleResolve(url);
    if (pathname === "/proxy") return handleProxy(url, request);

    return json({
      routes: {
        "/s25": "Holly scraper",
        "/rttps://...": "Goodstream resolver",
        "/p&h=...": "HLS proxy",
      },
    });
  },
};
