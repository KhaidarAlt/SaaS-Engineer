const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 3001;
const REPLIT_HOST = process.env.REPLIT_HOST || "saa-s-engineer--m528dpa.replit.app";
const CACHE_TTL = 5 * 60 * 1000;

const cache = new Map();

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function generateOgHtml(title, description, image, url) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  ${image ? `<meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />` : ""}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}" />` : ""}
</head>
<body>
  <p>${escapeHtml(title)} — ${escapeHtml(description)}</p>
</body>
</html>`;
}

function fetchCatalog(slug) {
  return new Promise((resolve, reject) => {
    const url = `https://${REPLIT_HOST}/api/catalog/${encodeURIComponent(slug)}`;
    https
      .get(url, { headers: { "User-Agent": "OG-Bot-Proxy/1.0" } }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error("Invalid JSON from API"));
          }
        });
      })
      .on("error", reject);
  });
}

function extractSlug(host, path) {
  const subMatch = host.match(/^([a-z0-9][a-z0-9-]+)\.botfactory\.kz$/i);
  if (subMatch) return subMatch[1];
  const pathMatch = path.match(/^\/c\/([^/]+)/);
  if (pathMatch) return pathMatch[1];
  return null;
}

function resolveImageUrl(imageRaw, slug) {
  if (!imageRaw) return "";
  if (imageRaw.startsWith("http")) return imageRaw;
  return `https://${slug}.botfactory.kz${imageRaw.startsWith("/") ? "" : "/"}${imageRaw}`;
}

async function handleRequest(req, res) {
  const host = req.headers["host"] || "";
  const path = req.url || "/";

  console.log(`[OG-Proxy] ${req.method} ${host}${path} ua=${(req.headers["user-agent"] || "").substring(0, 60)}`);

  if (path === "/robots.txt") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(
      "User-agent: *\nAllow: /\n\nUser-agent: facebookexternalhit\nAllow: /\n\nUser-agent: WhatsApp\nAllow: /\n\nUser-agent: TelegramBot\nAllow: /\n"
    );
    return;
  }

  if (path === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }

  const slug = extractSlug(host, path);

  if (!slug) {
    const html = generateOgHtml(
      "SmartCatalog — Умный каталог для вашего бизнеса",
      "Создайте красивый онлайн-каталог товаров, управляйте заказами через WhatsApp",
      "",
      "https://botfactory.kz"
    );
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  try {
    const cached = cache.get(slug);
    let catalogData;
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      catalogData = cached.data;
    } else {
      catalogData = await fetchCatalog(slug);
      cache.set(slug, { data: catalogData, ts: Date.now() });
    }

    const tenant = catalogData.tenant || catalogData;
    const title = tenant.ogTitle || tenant.name || slug;
    const description =
      tenant.ogDescription || tenant.description || "Онлайн-каталог товаров";
    const imageRaw = tenant.ogImageUrl || tenant.logoUrl || "";
    const image = resolveImageUrl(imageRaw, slug);
    const canonicalUrl = `https://${slug}.botfactory.kz`;

    console.log(`[OG-Proxy] Serving OG for ${slug}: title="${title}", image=${image || "none"}`);

    const html = generateOgHtml(title, description, image, canonicalUrl);
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    });
    res.end(html);
  } catch (err) {
    console.error(`[OG-Proxy] Error fetching catalog for ${slug}:`, err.message);
    const html = generateOgHtml(
      slug,
      "Онлайн-каталог товаров",
      "",
      `https://${slug}.botfactory.kz`
    );
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  }
}

const server = http.createServer(handleRequest);
server.listen(PORT, "127.0.0.1", () => {
  console.log(`[OG-Proxy] Listening on 127.0.0.1:${PORT}`);
});
