import OpenAI from "openai";
import type { ScrapeResult } from "./telegramScraper";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export interface ExtractedProduct {
  name: string;
  description: string;
  price: number;
  category: string;
  sku: string;
  imageUrl?: string;
}

interface ExtractionProgress {
  pct: number;
  message: string;
  products: ExtractedProduct[];
}

export async function extractProductsFromPosts(
  scrapeResult: ScrapeResult,
  onProgress?: (progress: ExtractionProgress) => void,
): Promise<ExtractedProduct[]> {
  const postsWithContent = scrapeResult.posts.filter(
    (p) => p.text.length > 15 || p.imageUrls.length > 0,
  );

  if (postsWithContent.length === 0) {
    throw new Error("Не найдены посты с товарами в канале");
  }

  const batches: typeof postsWithContent[] = [];
  const batchSize = 5;
  for (let i = 0; i < postsWithContent.length; i += batchSize) {
    batches.push(postsWithContent.slice(i, i + batchSize));
  }

  const allProducts: ExtractedProduct[] = [];
  const seenNames = new Set<string>();

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const pct = Math.round(((batchIdx + 1) / batches.length) * 80) + 10;

    onProgress?.({
      pct,
      message: `Анализ постов (${batchIdx + 1}/${batches.length})...`,
      products: allProducts,
    });

    const postsText = batch
      .map((post, idx) => {
        let entry = `--- Пост ${batchIdx * batchSize + idx + 1} ---\n${post.text}`;
        if (post.imageUrls.length > 0) {
          entry += `\n[Изображения: ${post.imageUrls.length} шт]`;
        }
        return entry;
      })
      .join("\n\n");

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    const hasImages = batch.some((p) => p.imageUrls.length > 0);

    if (hasImages) {
      const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] =
        [
          {
            type: "text",
            text: buildExtractionPrompt(postsText, scrapeResult.channelTitle),
          },
        ];

      for (const post of batch) {
        for (const imgUrl of post.imageUrls.slice(0, 2)) {
          contentParts.push({
            type: "image_url",
            image_url: { url: imgUrl, detail: "low" },
          });
        }
      }

      messages.push({ role: "user", content: contentParts });
    } else {
      messages.push({
        role: "user",
        content: buildExtractionPrompt(
          postsText,
          scrapeResult.channelTitle,
        ),
      });
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              'Ты помощник для извлечения товаров из постов Telegram-канала. Отвечай ТОЛЬКО валидным JSON массивом. Без markdown, без ```json.',
          },
          ...messages,
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content || "";
      const parsed = JSON.parse(content);
      const products: ExtractedProduct[] = parsed.products || [];

      for (const product of products) {
        if (!product.name || product.name.length < 2) continue;

        const normalizedName = product.name.toLowerCase().trim();
        if (seenNames.has(normalizedName)) continue;
        seenNames.add(normalizedName);

        if (!product.price || product.price <= 0) {
          product.price = 0;
        }
        if (!product.category) {
          product.category = "Товары";
        }
        if (!product.description) {
          product.description = "";
        }
        if (!product.sku) {
          product.sku = `MI-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
        }

        const matchingPost = batch.find(
          (p) =>
            p.text.toLowerCase().includes(normalizedName.slice(0, 10)) &&
            p.imageUrls.length > 0,
        );
        if (matchingPost) {
          product.imageUrl = matchingPost.imageUrls[0];
        }

        allProducts.push(product);
      }
    } catch (err) {
      console.error(`Error extracting batch ${batchIdx}:`, err);
    }

    if (allProducts.length >= 20) break;
  }

  onProgress?.({
    pct: 95,
    message: `Извлечено ${allProducts.length} товаров`,
    products: allProducts,
  });

  return allProducts.slice(0, 20);
}

function buildExtractionPrompt(postsText: string, channelTitle: string): string {
  return `Проанализируй посты из Telegram-канала "${channelTitle}" и извлеки товары.

Для каждого товара верни:
- name: название товара (кратко, без лишнего)
- description: описание (2-3 предложения из поста)
- price: цена в тенге (число, 0 если не указана)
- category: категория товара

Если в посте нет товара (просто новости, приветствия, опросы) — пропусти его.

Верни JSON: {"products": [{"name":"...", "description":"...", "price": 0, "category":"..."}]}

Посты:
${postsText}`;
}
