import { db } from "../../db";
import { aiConversations, aiMessages } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IChatStorage {
  getConversation(id: string): Promise<typeof aiConversations.$inferSelect | undefined>;
  getAllConversations(): Promise<(typeof aiConversations.$inferSelect)[]>;
  createConversation(title: string, tenantId?: string): Promise<typeof aiConversations.$inferSelect>;
  deleteConversation(id: string): Promise<void>;
  getMessagesByConversation(conversationId: string): Promise<(typeof aiMessages.$inferSelect)[]>;
  createMessage(conversationId: string, role: string, content: string): Promise<typeof aiMessages.$inferSelect>;
}

export const chatStorage: IChatStorage = {
  async getConversation(id: string) {
    const [conversation] = await db.select().from(aiConversations).where(eq(aiConversations.id, id));
    return conversation;
  },

  async getAllConversations() {
    return db.select().from(aiConversations).orderBy(desc(aiConversations.createdAt));
  },

  async createConversation(title: string, tenantId?: string) {
    const [conversation] = await db.insert(aiConversations).values({ title, tenantId } as any).returning();
    return conversation;
  },

  async deleteConversation(id: string) {
    await db.delete(aiMessages).where(eq(aiMessages.conversationId, id));
    await db.delete(aiConversations).where(eq(aiConversations.id, id));
  },

  async getMessagesByConversation(conversationId: string) {
    return db.select().from(aiMessages).where(eq(aiMessages.conversationId, conversationId)).orderBy(aiMessages.createdAt);
  },

  async createMessage(conversationId: string, role: string, content: string) {
    const [message] = await db.insert(aiMessages).values({ conversationId, role, content }).returning();
    return message;
  },
};

