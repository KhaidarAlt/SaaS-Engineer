interface ScrapedPost {
  text: string;
  imageUrls: string[];
  date?: string;
  postId?: number;
}

export interface ScrapeResult {
  channelName: string;
  channelTitle: string;
  posts: ScrapedPost[];
}

interface ScrapeOptions {
  maxPages?: number;
}

export async function scrapeTelegramChannel(
  username: string,
  options?: ScrapeOptions,
): Promise<ScrapeResult> {
  const cleanUsername = username.replace(/^@/, '').replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '').replace(/\/$/, '');

  if (!/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(cleanUsername)) {
    throw new Error("Некорректное имя канала");
  }

  const maxPages = options?.maxPages ?? 1;
  const allPosts: ScrapedPost[] = [];
  let channelTitle = cleanUsername;
  let beforeId: number | undefined;
  let pagesLoaded = 0;

  while (pagesLoaded < maxPages) {
    let url = `https://t.me/s/${cleanUsername}`;
    if (beforeId) {
      url += `?before=${beforeId}`;
    }

    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
      },
    });

    if (!resp.ok) {
      if (pagesLoaded === 0) {
        throw new Error(`Не удалось загрузить канал: ${resp.status}`);
      }
      break;
    }

    const html = await resp.text();

    if (pagesLoaded === 0) {
      if (html.includes("tgme_page_description") && html.includes("private")) {
        throw new Error("Канал является приватным");
      }

      if (html.includes("If you have <strong>Telegram</strong>") && !html.includes("tgme_widget_message_wrap")) {
        throw new Error("Канал не найден или пустой");
      }

      channelTitle = extractChannelTitle(html) || cleanUsername;
    }

    const pagePosts = extractPosts(html);
    if (pagePosts.length === 0) break;

    allPosts.push(...pagePosts);

    const minPostId = Math.min(
      ...pagePosts.filter(p => p.postId !== undefined).map(p => p.postId!)
    );
    if (!isFinite(minPostId) || minPostId <= 1) break;

    beforeId = minPostId;
    pagesLoaded++;

    if (pagesLoaded < maxPages) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return {
    channelName: cleanUsername,
    channelTitle,
    posts: allPosts,
  };
}

function extractChannelTitle(html: string): string | null {
  const match = html.match(/<div class="tgme_channel_info_header_title"[^>]*><span[^>]*>([^<]+)<\/span>/);
  if (match) return match[1].trim();

  const ogMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
  if (ogMatch) return ogMatch[1].trim();

  return null;
}

function extractPosts(html: string): ScrapedPost[] {
  const posts: ScrapedPost[] = [];

  const messageBlocks = html.split(/class="tgme_widget_message_wrap/g);

  for (let i = 1; i < messageBlocks.length; i++) {
    const block = messageBlocks[i];

    const imageUrls = extractImages(block);
    const text = extractText(block);
    const date = extractDate(block);
    const postId = extractPostId(block);

    if (!text && imageUrls.length === 0) continue;

    posts.push({ text, imageUrls, date, postId });
  }

  return posts;
}

function extractImages(block: string): string[] {
  const urls: string[] = [];

  const bgMatches = block.matchAll(/background-image:\s*url\('([^']+)'\)/g);
  for (const m of bgMatches) {
    const url = m[1];
    if (url && !url.includes("emoji") && !url.includes("avatar")) {
      urls.push(url);
    }
  }

  const imgMatches = block.matchAll(/<img[^>]+src="([^"]+)"[^>]*class="[^"]*tgme_widget_message_photo/g);
  for (const m of imgMatches) {
    urls.push(m[1]);
  }

  const photoMatches = block.matchAll(/class="tgme_widget_message_photo_wrap[^"]*"[^>]*style="[^"]*background-image:\s*url\('([^']+)'\)/g);
  for (const m of photoMatches) {
    if (m[1] && !m[1].includes("emoji")) {
      if (!urls.includes(m[1])) {
        urls.push(m[1]);
      }
    }
  }

  return urls;
}

function extractText(block: string): string {
  const textMatch = block.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)(?:<\/div>)/);
  if (!textMatch) return "";

  let text = textMatch[1];
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

function extractDate(block: string): string | undefined {
  const dateMatch = block.match(/datetime="([^"]+)"/);
  return dateMatch?.[1];
}

function extractPostId(block: string): number | undefined {
  const idMatch = block.match(/data-post="[^/]+\/(\d+)"/);
  if (idMatch) return parseInt(idMatch[1], 10);
  return undefined;
}
