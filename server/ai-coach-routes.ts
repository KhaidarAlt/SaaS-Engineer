import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import {
  aiLearningSuggestions,
  knowledgeItems,
  aiKnowledgeArticles,
  aiTrainingEvents,
} from "@shared/schema";
import { analyzeDialogs } from "./services/ai-coach.service";
import { embedKnowledgeItem } from "./services/embeddings";
import type { IStorage } from "./storage";
import { z } from "zod";

export function registerAiCoachRoutes(
  app: Express,
  storage: IStorage,
  requireAuth: any,
  requireAiAccess: any,
) {
  app.post("/api/ai/coach/analyze", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;
      const result = await analyzeDialogs(tenantId);
      res.json(result);
    } catch (error: any) {
      console.error("[AiCoach] analyze error:", error);
      res.status(500).json({ message: "Ошибка при анализе диалогов", error: error.message });
    }
  });

  app.get("/api/ai/coach/suggestions", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;
      const status = (req.query.status as string) || undefined;

      let query = db
        .select()
        .from(aiLearningSuggestions)
        .where(
          status
            ? and(eq(aiLearningSuggestions.tenantId, tenantId), eq(aiLearningSuggestions.status, status))
            : eq(aiLearningSuggestions.tenantId, tenantId)
        )
        .orderBy(desc(aiLearningSuggestions.createdAt));

      const suggestions = await query;
      res.json(suggestions);
    } catch (error: any) {
      console.error("[AiCoach] list error:", error);
      res.status(500).json({ message: "Ошибка при получении рекомендаций" });
    }
  });

  app.post("/api/ai/coach/suggestions/:id/approve", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;
      const { id } = req.params;

      const [suggestion] = await db
        .select()
        .from(aiLearningSuggestions)
        .where(and(eq(aiLearningSuggestions.id, id), eq(aiLearningSuggestions.tenantId, tenantId)));

      if (!suggestion) {
        return res.status(404).json({ message: "Рекомендация не найдена" });
      }

      if (suggestion.status !== "pending") {
        return res.status(400).json({ message: "Рекомендация уже обработана" });
      }

      const result = await db.transaction(async (tx) => {
        const [kbItem] = await tx.insert(knowledgeItems).values({
          tenantId,
          type: "ARTICLE",
          title: suggestion.topic,
          content: suggestion.suggestedContent,
          source: "TRAINING",
          isActive: true,
        }).returning();

        await tx.insert(aiKnowledgeArticles).values({
          tenantId,
          title: suggestion.topic,
          content: suggestion.suggestedContent,
          category: "ai-coach",
          isPublished: true,
        });

        await tx
          .update(aiLearningSuggestions)
          .set({ status: "approved" })
          .where(eq(aiLearningSuggestions.id, id));

        await tx.insert(aiTrainingEvents).values({
          tenantId,
          eventType: "KB_ADDED",
          context: { source: "ai_coach", topic: suggestion.topic, suggestionId: id },
        });

        return kbItem;
      });

      embedKnowledgeItem(result.id, suggestion.suggestedContent, suggestion.topic).catch(err =>
        console.error("[Embeddings] async embed failed:", err)
      );

      res.json({ success: true, message: "Знание одобрено и добавлено в базу" });
    } catch (error: any) {
      console.error("[AiCoach] approve error:", error);
      res.status(500).json({ message: "Ошибка при одобрении" });
    }
  });

  app.post("/api/ai/coach/suggestions/:id/reject", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;
      const { id } = req.params;

      const [suggestion] = await db
        .select()
        .from(aiLearningSuggestions)
        .where(and(eq(aiLearningSuggestions.id, id), eq(aiLearningSuggestions.tenantId, tenantId)));

      if (!suggestion) {
        return res.status(404).json({ message: "Рекомендация не найдена" });
      }

      await db
        .update(aiLearningSuggestions)
        .set({ status: "rejected" })
        .where(eq(aiLearningSuggestions.id, id));

      res.json({ success: true });
    } catch (error: any) {
      console.error("[AiCoach] reject error:", error);
      res.status(500).json({ message: "Ошибка при отклонении" });
    }
  });

  const updateSuggestionSchema = z.object({
    topic: z.string().min(1).optional(),
    suggestedContent: z.string().min(1).optional(),
  });

  app.put("/api/ai/coach/suggestions/:id", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;
      const { id } = req.params;

      const parsed = updateSuggestionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Некорректные данные", errors: parsed.error.flatten() });
      }

      const [suggestion] = await db
        .select()
        .from(aiLearningSuggestions)
        .where(and(eq(aiLearningSuggestions.id, id), eq(aiLearningSuggestions.tenantId, tenantId)));

      if (!suggestion) {
        return res.status(404).json({ message: "Рекомендация не найдена" });
      }

      if (suggestion.status !== "pending") {
        return res.status(400).json({ message: "Можно редактировать только ожидающие рекомендации" });
      }

      const updates: Record<string, any> = {};
      if (parsed.data.suggestedContent) updates.suggestedContent = parsed.data.suggestedContent;
      if (parsed.data.topic) updates.topic = parsed.data.topic;

      if (Object.keys(updates).length > 0) {
        await db
          .update(aiLearningSuggestions)
          .set(updates)
          .where(eq(aiLearningSuggestions.id, id));
      }

      const [updated] = await db
        .select()
        .from(aiLearningSuggestions)
        .where(eq(aiLearningSuggestions.id, id));

      res.json(updated);
    } catch (error: any) {
      console.error("[AiCoach] update error:", error);
      res.status(500).json({ message: "Ошибка при обновлении" });
    }
  });
}
