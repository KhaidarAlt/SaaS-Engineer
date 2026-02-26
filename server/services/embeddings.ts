import OpenAI from "openai";
import { db } from "../db";
import { pool } from "../db";
import { eq, and, isNull } from "drizzle-orm";
import { knowledgeItems } from "@shared/schema";
import type { KnowledgeItem } from "@shared/schema";

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
