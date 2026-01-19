import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { AiPaywall } from "@/components/AiPaywall";
import { Send, Bot, User, RefreshCw, MessageSquare, ArrowLeft, ExternalLink } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

function formatMessageContent(content: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(urlRegex);
  
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      urlRegex.lastIndex = 0;
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary underline hover:text-primary/80 font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {part.includes('/catalog/') ? '🛍️ Открыть каталог' : part}
          <ExternalLink className="h-3 w-3" />
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

interface AiMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface AiConversation {
  id: string;
  channel: string;
  sessionId: string;
  createdAt: string;
}

export default function AiSandboxPage() {
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: status } = useQuery<{ hasAccess: boolean; planName?: string }>({
    queryKey: ["/api/ai/status"],
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<AiMessage[]>({
    queryKey: ["/api/ai/conversations", conversationId, "messages"],
    enabled: !!conversationId && status?.hasAccess,
  });

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/conversations", { channel: "sandbox" });
      return res.json();
    },
    onSuccess: (data: AiConversation) => {
      setConversationId(data.id);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", `/api/ai/conversations/${conversationId}/messages`, { content, role: "user" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/conversations", conversationId, "messages"] });
      setMessage("");
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!message.trim() || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(message.trim());
  };

  const handleNewConversation = () => {
    setConversationId(null);
    createConversationMutation.mutate();
  };

  if (!status?.hasAccess) {
    return <div className="p-6"><AiPaywall currentPlan={status?.planName} /></div>;
  }

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col p-6 gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/ai">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Песочница</h1>
            <p className="text-muted-foreground">Тестируйте диалоги с AI-ассистентом</p>
          </div>
        </div>
        <Button onClick={handleNewConversation} variant="outline" data-testid="button-new-conversation">
          <RefreshCw className="mr-2 h-4 w-4" />
          Новый диалог
        </Button>
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {conversationId ? "Тестовый диалог" : "Начните новый диалог"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 pb-4">
          {!conversationId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <Bot className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Протестируйте AI-ассистента</p>
              <p className="text-muted-foreground mb-4">
                Создайте тестовый диалог, чтобы проверить работу скриптов и ответы
              </p>
              <Button onClick={() => createConversationMutation.mutate()} disabled={createConversationMutation.isPending} data-testid="button-start-conversation">
                Начать диалог
              </Button>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
                <div className="space-y-4 pb-4">
                  {messagesLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
                    </div>
                  ) : messages?.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      Отправьте первое сообщение
                    </div>
                  ) : (
                    messages?.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex gap-3",
                          msg.role === "user" ? "justify-end" : "justify-start"
                        )}
                        data-testid={`message-${msg.id}`}
                      >
                        {msg.role === "assistant" && (
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bot className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "max-w-[70%] rounded-lg px-4 py-2",
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap">{formatMessageContent(msg.content)}</p>
                          <p className="text-xs opacity-60 mt-1">
                            {new Date(msg.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        {msg.role === "user" && (
                          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                            <User className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              <div className="flex gap-2 pt-4 border-t">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Напишите сообщение..."
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  disabled={sendMessageMutation.isPending}
                  data-testid="input-message"
                />
                <Button onClick={handleSend} disabled={!message.trim() || sendMessageMutation.isPending} data-testid="button-send">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
