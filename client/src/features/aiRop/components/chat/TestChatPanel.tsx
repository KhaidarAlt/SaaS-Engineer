import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Pencil, Check, Loader2, MessageCircle, Bot, User, X } from "lucide-react";
import { sendTestMessage, trainFromMessage } from "../../api/aiRopApi";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage, TestChatResponse } from "../../types/aiRopTypes";

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  stageLabel?: string | null;
  isTyping?: boolean;
}

const TRAIN_ACTIONS = [
  { action: "fix_only" as const, label: "Исправить только здесь" },
  { action: "train_future" as const, label: "Обучить на будущее" },
  { action: "add_knowledge" as const, label: "Добавить в базу знаний" },
  { action: "anti_pattern" as const, label: "Отметить как плохой пример" },
];

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block w-2 h-2 rounded-full bg-green-500 dark:bg-green-400"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

function TrainActionModal({
  messageId,
  onClose,
  editedText,
}: {
  messageId: string;
  onClose: () => void;
  editedText?: string;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (action: "fix_only" | "train_future" | "add_knowledge" | "anti_pattern") => {
    setLoading(action);
    try {
      await trainFromMessage({
        messageId,
        action,
        correctedText: editedText,
      });
      toast({
        title: "Действие выполнено",
        description: "Обучение AI обновлено",
      });
      onClose();
    } catch {
      toast({
        title: "Ошибка",
        description: "Не удалось выполнить действие",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card className="w-full max-w-sm mx-4">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base">Действие с ответом AI</CardTitle>
          <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-train-modal">
            <X />
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {TRAIN_ACTIONS.map(({ action, label }) => (
            <Button
              key={action}
              variant="outline"
              className="justify-start"
              disabled={loading !== null}
              onClick={() => handleAction(action)}
              data-testid={`button-train-${action}`}
            >
              {loading === action && <Loader2 className="animate-spin" />}
              {label}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function TestChatPanel() {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showTrainModal, setShowTrainModal] = useState<string | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isSending) return;

    const userMsg: LocalMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };

    const typingMsg: LocalMessage = {
      id: `typing-${Date.now()}`,
      role: "assistant",
      content: "",
      isTyping: true,
    };

    setMessages((prev) => [...prev, userMsg, typingMsg]);
    setInputValue("");
    setIsSending(true);

    try {
      const response: TestChatResponse = await sendTestMessage(text, conversationId ?? undefined);

      setMessages((prev) =>
        prev.map((m) =>
          m.isTyping
            ? {
                id: response.messageId,
                role: "assistant" as const,
                content: response.message,
                stageLabel: response.stageLabel,
                isTyping: false,
              }
            : m
        )
      );

      if (response.conversationId) {
        setConversationId(response.conversationId);
      }
    } catch {
      setMessages((prev) => prev.filter((m) => !m.isTyping));
      toast({
        title: "Ошибка",
        description: "Не удалось отправить сообщение",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startEdit = (msg: LocalMessage) => {
    setEditingMessageId(msg.id);
    setEditText(msg.content);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditText("");
  };

  const saveEdit = async () => {
    if (!editingMessageId || !editText.trim()) return;

    try {
      await trainFromMessage({
        messageId: editingMessageId,
        action: "fix_only",
        correctedText: editText.trim(),
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === editingMessageId ? { ...m, content: editText.trim() } : m
        )
      );

      toast({
        title: "Ответ исправлен",
        description: "AI ответ обновлён",
      });
    } catch {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить исправление",
        variant: "destructive",
      });
    } finally {
      setEditingMessageId(null);
      setEditText("");
    }
  };

  const STAGE_LABELS: Record<string, string> = {
    greeting: "Приветствие",
    need_detection: "Выявление потребности",
    product_offer: "Предложение товара",
    objection_handling: "Работа с возражениями",
    closing_attempt: "Закрытие сделки",
    order_created: "Заказ создан",
    payment: "Оплата",
    handover: "Передача менеджеру",
  };

  return (
    <Card className="flex flex-col h-full" data-testid="test-chat-panel">
      <CardHeader className="flex flex-row items-center gap-2 pb-3 border-b">
        <MessageCircle className="text-green-600 dark:text-green-400" />
        <CardTitle className="text-base">Тестовый чат с AI</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 p-0 min-h-0">
        <div
          className="flex-1 overflow-y-auto p-4 space-y-3"
          data-testid="chat-messages"
          style={{ maxHeight: "calc(100vh - 280px)" }}
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-12">
              <Bot className="w-10 h-10 opacity-40" />
              <p className="text-sm">Напишите сообщение, чтобы начать тестирование</p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                data-testid={`chat-message-${msg.id}`}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className="flex flex-col max-w-[80%] gap-1">
                  <div className="flex items-start gap-2">
                    {msg.role === "assistant" && (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mt-1">
                        <Bot className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </div>
                    )}

                    <div
                      className={
                        msg.role === "user"
                          ? "bg-muted rounded-lg rounded-tr-sm px-3 py-2 text-sm"
                          : "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/40 rounded-lg rounded-tl-sm px-3 py-2 text-sm"
                      }
                    >
                      {msg.isTyping ? (
                        <TypingDots />
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      )}
                    </div>

                    {msg.role === "user" && (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center mt-1">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {msg.role === "assistant" && msg.stageLabel && (
                    <span className="text-xs text-muted-foreground ml-9">
                      {STAGE_LABELS[msg.stageLabel] || msg.stageLabel}
                    </span>
                  )}

                  {msg.role === "assistant" && !msg.isTyping && msg.content && (
                    <div className="flex items-center gap-1 ml-9">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(msg)}
                        data-testid={`button-edit-${msg.id}`}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowTrainModal(msg.id)}
                        data-testid={`button-approve-${msg.id}`}
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                    </div>
                  )}

                  {editingMessageId === msg.id && (
                    <div className="ml-9 flex flex-col gap-2 mt-1">
                      <textarea
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[60px] resize-y"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        data-testid={`textarea-edit-${msg.id}`}
                      />
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={saveEdit} data-testid={`button-save-edit-${msg.id}`}>
                          Сохранить
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit} data-testid={`button-cancel-edit-${msg.id}`}>
                          Отмена
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>

        <div className="border-t p-3 flex items-center gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Введите сообщение..."
            disabled={isSending}
            data-testid="chat-input"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={isSending || !inputValue.trim()}
            data-testid="button-send-message"
          >
            {isSending ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </div>
      </CardContent>

      {showTrainModal && (
        <TrainActionModal
          messageId={showTrainModal}
          onClose={() => setShowTrainModal(null)}
          editedText={
            messages.find((m) => m.id === showTrainModal)?.content
          }
        />
      )}
    </Card>
  );
}
