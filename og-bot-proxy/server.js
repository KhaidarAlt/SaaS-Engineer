const http = require("http");
const https = require("https");
const httpProxy = require("http-proxy");

const PORT = process.env.PORT || 3001;
const REPLIT_HOST = process.env.REPLIT_HOST || "saa-s-engineer--m528dpa.replit.app";
const CACHE_TTL = 5 * 60 * 1000;

const cache = new Map();

const BOT_REGEX = /facebookexternalhit|Facebot|WhatsApp|TelegramBot|Twitterbot|LinkedInBot|Slackbot|vkShare|Googlebot|YandexBot|bingbot|Discordbot/i;

const proxy = httpProxy.createProxyServer({
  target: `https://${REPLIT_HOST}`,
  changeOrigin: true,
  secure: true,
  followRedirects: false,
  proxyTimeout: 30000,
  timeout: 30000,
  headers: {
    Host: REPLIT_HOST,
  },
});

proxy.on("proxyReq", (proxyReq, req) => {
  proxyReq.setHeader("Host", REPLIT_HOST);
  proxyReq.setHeader("X-Forwarded-Host", req.headers["host"] || "");
  proxyReq.setHeader("X-Forwarded-Proto", "https");
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
  proxyReq.setHeader("X-Forwarded-For", clientIp);
});

proxy.on("error", (err, req, res) => {
  const host = req.headers["host"] || "";
  const ua = (req.headers["user-agent"] || "").substring(0, 80);
  console.error(`[PROXY-ERR] ${host}${req.url} UA="${ua}" err=${err.message}`);
  if (!res.headersSent) {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Bad Gateway");
  }
});

function isBot(userAgent) {
  return BOT_REGEX.test(userAgent || "");
}

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

async function serveBotOg(req, res, slug, host) {
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
    const description = tenant.ogDescription || tenant.description || "Онлайн-каталог товаров";
    const imageRaw = tenant.ogImageUrl || tenant.logoUrl || "";
    const image = resolveImageUrl(imageRaw, slug);
    const canonicalUrl = `https://${slug}.botfactory.kz`;

    console.log(`[BOT-OG] slug=${slug} title="${title}" image=${image || "none"}`);

    const html = generateOgHtml(title, description, image, canonicalUrl);
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    });
    res.end(html);
  } catch (err) {
    console.error(`[BOT-OG] Error for ${slug}:`, err.message);
    const html = generateOgHtml(slug, "Онлайн-каталог товаров", "", `https://${slug}.botfactory.kz`);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  }
}

function handleRequest(req, res) {
  const host = req.headers["host"] || "";
  const path = req.url || "/";
  const ua = req.headers["user-agent"] || "";
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
  const bot = isBot(ua);

  const isAssetReq = /^\/(objects\/uploads|assets|favicon|images|api)\//i.test(path) || /\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|woff2?|ttf|mp4|pdf)(\?|$)/i.test(path);
  const routeLabel = bot ? (isAssetReq ? "BOT-ASSET-PROXY" : "BOT") : "PROXY";
  console.log(`[REQ] ${clientIp} | ${host}${path} | UA="${ua.substring(0, 100)}" | -> ${routeLabel}`);

  if (path === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }

  if (path === "/robots.txt") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(
      "User-agent: *\nAllow: /\n\nUser-agent: facebookexternalhit\nAllow: /\n\nUser-agent: WhatsApp\nAllow: /\n\nUser-agent: TelegramBot\nAllow: /\n"
    );
    return;
  }

  if (bot && !isAssetReq) {
    const slug = extractSlug(host, path);
    serveBotOg(req, res, slug, host);
    return;
  }

  proxy.web(req, res);
}

const server = http.createServer(handleRequest);
server.listen(PORT, "0.0.0.0", () => {
  console.log(`[OG-Proxy] Listening on 0.0.0.0:${PORT}`);
  console.log(`[OG-Proxy] Bots -> OG HTML | Users -> ${REPLIT_HOST}`);
});
