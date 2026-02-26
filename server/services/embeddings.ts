import OpenAI from "openai";
import { db } from "../db";
import { pool } from "../db";
import { eq, and, isNull } from "drizzle-orm";
import { knowledgeItems, products } from "@shared/schema";
import type { KnowledgeItem, Product } from "@shared/schema";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export async function generateEmbedding(text: string): Promise<number[]> {
  const input = text.slice(0, 8000);
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input,
  });
  return response.data[0].embedding;
}

export async function embedKnowledgeItem(itemId: string, content: string, title?: string): Promise<void> {
  const textToEmbed = title ? `${title}\n\n${content}` : content;
  const embeddingVector = await generateEmbedding(textToEmbed);
  const vectorStr = `[${embeddingVector.join(",")}]`;

  await pool.query(
    `UPDATE knowledge_items SET embedding = $1::vector WHERE id = $2`,
    [vectorStr, itemId]
  );
}

export async function searchKnowledgeBySimilarity(
  tenantId: string,
  queryText: string,
  limit: number = 5
): Promise<(KnowledgeItem & { similarity: number })[]> {
  const queryEmbedding = await generateEmbedding(queryText);
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  const result = await pool.query(
    `SELECT *, 1 - (embedding <=> $1::vector) AS similarity
     FROM knowledge_items
     WHERE tenant_id = $2
       AND is_active = true
       AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [vectorStr, tenantId, limit]
  );

  return result.rows.map((row: any) => ({
    id: row.id,
    tenantId: row.tenant_id,
    type: row.type,
    title: row.title,
    content: row.content,
    source: row.source,
    tags: row.tags,
    isActive: row.is_active,
    embedding: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    similarity: parseFloat(row.similarity),
  }));
}

export async function backfillEmbeddings(tenantId: string): Promise<number> {
  const items = await db
    .select({ id: knowledgeItems.id, title: knowledgeItems.title, content: knowledgeItems.content })
    .from(knowledgeItems)
    .where(
      and(
        eq(knowledgeItems.tenantId, tenantId),
        eq(knowledgeItems.isActive, true),
        isNull(knowledgeItems.embedding)
      )
    );

  let count = 0;
  for (const item of items) {
    try {
      await embedKnowledgeItem(item.id, item.content, item.title);
      count++;
    } catch (err) {
      console.error(`[Embeddings] Failed to embed item ${item.id}:`, err);
    }
  }

  return count;
}

export async function hasEmbeddings(tenantId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT EXISTS(SELECT 1 FROM knowledge_items WHERE tenant_id = $1 AND embedding IS NOT NULL) as has`,
    [tenantId]
  );
  return result.rows[0].has;
}

export async function embedProduct(productId: string, name: string, description?: string | null, category?: string | null): Promise<void> {
  const parts = [name];
  if (category) parts.push(`Категория: ${category}`);
  if (description) parts.push(description);
  const textToEmbed = parts.join("\n");
  const embeddingVector = await generateEmbedding(textToEmbed);
  const vectorStr = `[${embeddingVector.join(",")}]`;

  await pool.query(
    `UPDATE products SET embedding = $1::vector WHERE id = $2`,
    [vectorStr, productId]
  );
}

export interface ProductSearchResult {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  price: string;
  mainImageUrl: string | null;
  categoryId: string | null;
  inStock: boolean;
  similarity: number;
}

export async function searchProductsBySimilarity(
  tenantId: string,
  queryText: string,
  limit: number = 5
): Promise<ProductSearchResult[]> {
  const queryEmbedding = await generateEmbedding(queryText);
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  const result = await pool.query(
    `SELECT id, tenant_id, name, description, price, main_image_url, category_id, in_stock,
            1 - (embedding <=> $1::vector) AS similarity
     FROM products
     WHERE tenant_id = $2
       AND is_active = true
       AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [vectorStr, tenantId, limit]
  );

  return result.rows.map((row: any) => ({
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description,
    price: row.price,
    mainImageUrl: row.main_image_url,
    categoryId: row.category_id,
    inStock: row.in_stock,
    similarity: parseFloat(row.similarity),
  }));
}

export async function hasProductEmbeddings(tenantId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT EXISTS(SELECT 1 FROM products WHERE tenant_id = $1 AND embedding IS NOT NULL) as has`,
    [tenantId]
  );
  return result.rows[0].has;
}

export async function backfillProductEmbeddings(tenantId: string): Promise<number> {
  const categoryResult = await pool.query(
    `SELECT id, name FROM categories WHERE tenant_id = $1`,
    [tenantId]
  );
  const categoryMap = new Map<string, string>();
  categoryResult.rows.forEach((row: any) => categoryMap.set(row.id, row.name));

  const items = await db
    .select({ id: products.id, name: products.name, description: products.description, categoryId: products.categoryId })
    .from(products)
    .where(
      and(
        eq(products.tenantId, tenantId),
        eq(products.isActive, true),
        isNull(products.embedding)
      )
    );

  let count = 0;
  for (const item of items) {
    try {
      const catName = item.categoryId ? categoryMap.get(item.categoryId) : undefined;
      await embedProduct(item.id, item.name, item.description, catName);
      count++;
    } catch (err) {
      console.error(`[Embeddings] Failed to embed product ${item.id}:`, err);
    }
  }

  return count;
}
