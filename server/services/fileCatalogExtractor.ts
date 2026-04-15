import OpenAI from "openai";
import * as XLSX from "xlsx";
import type { ExtractedProduct } from "./productExtractor";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

interface ExtractionProgress {
  pct: number;
  message: string;
  products: ExtractedProduct[];
}

export async function parseFileToText(
  buffer: Buffer,
  mimetype: string,
  filename: string,
): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (
    ext === "xlsx" ||
    ext === "xls" ||
    ext === "csv" ||
    mimetype.includes("spreadsheet") ||
    mimetype.includes("excel") ||
    mimetype.includes("csv")
  ) {
    return parseExcel(buffer);
  }

  if (ext === "pdf" || mimetype === "application/pdf") {
    return parsePdf(buffer);
  }

  if (
    ext === "docx" ||
    ext === "doc" ||
    mimetype.includes("wordprocessingml") ||
    mimetype.includes("msword")
  ) {
    return parseDocx(buffer);
  }

  throw new Error(`Формат файла не поддерживается: ${ext || mimetype}`);
}

function parseExcel(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const lines: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (rows.length === 0) continue;

    lines.push(`=== Лист: ${sheetName} ===`);
    for (const row of rows) {
      const cells = (row as unknown[]).map((c) => String(c ?? "").trim()).filter(Boolean);
      if (cells.length > 0) {
        lines.push(cells.join(" | "));
      }
    }
    lines.push("");
  }

  if (lines.length === 0) throw new Error("Excel файл пустой или не содержит данных");
  return lines.join("\n");
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);
  if (!result.text?.trim()) throw new Error("PDF не содержит текста (возможно, это скан)");
  return result.text;
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  if (!result.value?.trim()) throw new Error("DOCX файл пустой");
  return result.value;
}

export async function extractProductsFromFileText(
  rawText: string,
  onProgress?: (progress: ExtractionProgress) => void,
): Promise<ExtractedProduct[]> {
  const maxChars = 28000;
  const text = rawText.length > maxChars ? rawText.slice(0, maxChars) + "\n...[обрезано]" : rawText;

  onProgress?.({ pct: 15, message: "Анализируем содержимое файла...", products: [] });

  const systemPrompt = `Ты — парсер прайс-листов и каталогов товаров. 
Из предоставленного текста (таблица, прайс, документ) извлеки список товаров.
Верни JSON массив объектов. Каждый объект:
{
  "name": "Название товара",
  "description": "Краткое описание (1-2 предложения, если есть)",
  "price": 1500,
  "category": "Категория",
  "sku": "Уникальный код (артикул если есть, иначе придумай короткий)"
}

Правила:
- price — число в тенге (если другая валюта — не конвертируй, просто число)
- Если цены нет — ставь 0
- Максимум 50 товаров
- Пропускай заголовки, итоги, пустые строки
- category — определи сам из контекста
- Не добавляй imageUrl — его нет в файлах
- Верни ТОЛЬКО JSON массив без markdown`;

  onProgress?.({ pct: 40, message: "ИИ распознаёт товары из файла...", products: [] });

  let raw = "";
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Вот содержимое файла:\n\n${text}` },
      ],
      temperature: 0.2,
      max_tokens: 8000,
    });
    raw = response.choices[0]?.message?.content ?? "[]";
  } catch (err) {
    throw new Error("Ошибка AI при распознавании товаров");
  }

  onProgress?.({ pct: 80, message: "Формируем каталог товаров...", products: [] });

  let products: ExtractedProduct[] = [];
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      products = parsed.slice(0, 50).map((p: Record<string, unknown>, i: number) => ({
        name: String(p.name ?? `Товар ${i + 1}`).trim(),
        description: String(p.description ?? "").trim(),
        price: Number(p.price ?? 0),
        category: String(p.category ?? "Общее").trim(),
        sku: String(p.sku ?? `file-${Date.now()}-${i}`).trim(),
        imageUrl: undefined,
      }));
    }
  } catch {
    throw new Error("Не удалось распознать товары из файла. Попробуйте другой файл.");
  }

  if (products.length === 0) {
    throw new Error("В файле не найдены товары с ценами. Проверьте формат прайс-листа.");
  }

  onProgress?.({ pct: 95, message: `Найдено ${products.length} товаров`, products });

  return products;
}
