import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { AiPaywall } from "@/components/AiPaywall";
import { 
  Send, 
  Bot, 
  RefreshCw, 
  ArrowLeft, 
  ExternalLink, 
  MoreVertical,
  Check,
  X,
  Pencil,
  Phone,
  Video,
  Smile
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

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
          className="inline-flex items-center gap-1 text-blue-600 underline hover:text-blue-800 font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {(part.includes('/catalog/') || part.includes('/c/')) ? 'Открыть каталог' : part}
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
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [lastUserMessage, setLastUserMessage] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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
      setLastUserMessage(content);
      return apiRequest("POST", `/api/ai/conversations/${conversationId}/messages`, { content, role: "user" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/conversations", conversationId, "messages"] });
      setMessage("");
    },
  });

  const saveCorrectionMutation = useMutation({
    mutationFn: async ({ messageId, originalContent, correctedContent, userMessage }: { 
      messageId: string; 
      originalContent: string; 
      correctedContent: string;
      userMessage: string;
    }) => {
      await apiRequest("POST", "/api/ai/corrections", {
        userMessagePattern: userMessage,
        originalResponse: originalContent,
        correctedResponse: correctedContent,
      });
      await apiRequest("PATCH", `/api/ai/messages/${messageId}`, {
        content: correctedContent,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/conversations", conversationId, "messages"] });
      setEditingMessageId(null);
      setEditedContent("");
      toast({
        title: "Сохранено",
        description: "Корректировка сохранена. AI запомнит этот ответ.",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить корректировку",
        variant: "destructive",
      });
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
    setLastUserMessage("");
    createConversationMutation.mutate();
  };

  const startEditing = (msg: AiMessage) => {
    setEditingMessageId(msg.id);
    setEditedContent(msg.content);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditedContent("");
  };

  const saveEditing = (msg: AiMessage) => {
    if (!editedContent.trim() || editedContent === msg.content) {
      cancelEditing();
      return;
    }
    
    const userMessages = messages?.filter(m => m.role === "user") || [];
    const msgIndex = messages?.findIndex(m => m.id === msg.id) || 0;
    let precedingUserMsg = "";
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages?.[i].role === "user") {
        precedingUserMsg = messages[i].content;
        break;
      }
    }
    
    saveCorrectionMutation.mutate({
      messageId: msg.id,
      originalContent: msg.content,
      correctedContent: editedContent.trim(),
      userMessage: precedingUserMsg || lastUserMessage,
    });
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
            <h1 className="text-2xl font-bold">Тестовый чат</h1>
            <p className="text-muted-foreground">Проверьте как AI отвечает клиентам</p>
          </div>
        </div>
        {conversationId && (
          <Button onClick={handleNewConversation} variant="outline" data-testid="button-new-conversation">
            <RefreshCw className="mr-2 h-4 w-4" />
            Новый диалог
          </Button>
        )}
      </div>

      <div className="flex-1 flex justify-center items-center">
        {!conversationId ? (
          <div className="text-center">
            <div className="w-80 mx-auto mb-6">
              <div className="bg-[#075E54] rounded-t-3xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                    <Bot className="h-6 w-6 text-gray-600" />
                  </div>
                  <div className="text-white text-left">
                    <p className="font-medium">AI Ассистент</p>
                    <p className="text-xs text-green-200">онлайн</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#ECE5DD] h-48 flex items-center justify-center">
                <p className="text-gray-500 text-sm">Начните диалог для тестирования</p>
              </div>
              <div className="bg-[#F0F0F0] rounded-b-3xl p-3">
                <div className="bg-white rounded-full px-4 py-2 text-gray-400 text-sm">
                  Введите сообщение...
                </div>
              </div>
            </div>
            <p className="text-lg font-medium mb-2">Проверьте AI-ассистента</p>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Откройте тестовый чат, чтобы увидеть как AI общается с клиентами. 
              Вы можете редактировать ответы — AI запомнит ваши корректировки.
            </p>
            <Button 
              onClick={() => createConversationMutation.mutate()} 
              disabled={createConversationMutation.isPending} 
              size="lg"
              data-testid="button-start-conversation"
            >
              Начать тестирование
            </Button>
          </div>
        ) : (
          <div className="w-full max-w-sm">
            <div className="bg-black rounded-[3rem] p-2 shadow-2xl">
              <div className="bg-black rounded-[2.5rem] overflow-hidden">
                <div className="bg-black pt-2 pb-1 px-6 flex justify-center">
                  <div className="w-24 h-6 bg-black rounded-b-2xl" />
                </div>
                
                <div className="bg-[#075E54] px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowLeft className="h-5 w-5 text-white" />
                      <div className="w-9 h-9 rounded-full bg-gray-300 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-gray-600" />
                      </div>
                      <div className="text-white">
                        <p className="font-medium text-sm leading-tight">AI Ассистент</p>
                        <p className="text-[10px] text-green-200">онлайн</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-white">
                      <Video className="h-5 w-5" />
                      <Phone className="h-5 w-5" />
                      <MoreVertical className="h-5 w-5" />
                    </div>
                  </div>
                </div>
                
                <div 
                  className="h-[480px] overflow-y-auto p-3"
                  style={{ 
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ccc" fill-opacity="0.15"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                    backgroundColor: '#ECE5DD'
                  }}
                  ref={scrollRef}
                >
                  {messagesLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                    </div>
                  ) : messages?.length === 0 ? (
                    <div className="text-center text-gray-500 py-8 text-sm">
                      Отправьте первое сообщение
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {messages?.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex",
                            msg.role === "user" ? "justify-end" : "justify-start"
                          )}
                          data-testid={`message-${msg.id}`}
                        >
                          <div
                            className={cn(
                              "max-w-[85%] rounded-lg px-3 py-2 shadow-sm relative group",
                              msg.role === "user"
                                ? "bg-[#DCF8C6] rounded-tr-none"
                                : "bg-white rounded-tl-none"
                            )}
                          >
                            {editingMessageId === msg.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editedContent}
                                  onChange={(e) => setEditedContent(e.target.value)}
                                  className="min-h-[80px] text-sm bg-white border-green-300 focus:border-green-500 text-gray-900 placeholder:text-gray-500"
                                  autoFocus
                                  data-testid="textarea-edit-message"
                                />
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={cancelEditing}
                                    className="h-7 px-2"
                                    data-testid="button-cancel-edit"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => saveEditing(msg)}
                                    disabled={saveCorrectionMutation.isPending}
                                    className="h-7 px-2 bg-[#075E54] hover:bg-[#064940]"
                                    data-testid="button-save-edit"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-[13px] whitespace-pre-wrap leading-relaxed text-gray-900">
                                  {formatMessageContent(msg.content)}
                                </p>
                                <div className="flex items-center justify-end gap-1 mt-1">
                                  <span className="text-[10px] text-gray-500">
                                    {new Date(msg.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                  {msg.role === "user" && (
                                    <Check className="h-3 w-3 text-blue-500" />
                                  )}
                                </div>
                                {msg.role === "assistant" && (
                                  <button
                                    onClick={() => startEditing(msg)}
                                    className="absolute -right-8 top-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-200"
                                    title="Редактировать ответ"
                                    data-testid={`button-edit-${msg.id}`}
                                  >
                                    <Pencil className="h-4 w-4 text-gray-500" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                      {sendMessageMutation.isPending && (
                        <div className="flex justify-start">
                          <div className="bg-white rounded-lg rounded-tl-none px-3 py-2 shadow-sm">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="bg-[#F0F0F0] px-2 py-2 flex items-center gap-2">
                  <button className="p-2 text-gray-500">
                    <Smile className="h-6 w-6" />
                  </button>
                  <div className="flex-1">
                    <Input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Сообщение"
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                      disabled={sendMessageMutation.isPending}
                      className="rounded-full border-0 bg-white h-10 text-sm text-gray-900 placeholder:text-gray-500"
                      data-testid="input-message"
                    />
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={!message.trim() || sendMessageMutation.isPending}
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                      message.trim() 
                        ? "bg-[#075E54] text-white hover:bg-[#064940]" 
                        : "bg-gray-300 text-gray-500"
                    )}
                    data-testid="button-send"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="bg-black h-1 flex justify-center items-end pb-1">
                  <div className="w-32 h-1 bg-white rounded-full" />
                </div>
              </div>
            </div>
            
            <p className="text-center text-xs text-muted-foreground mt-4">
              Наведите на ответ AI и нажмите <Pencil className="h-3 w-3 inline" /> чтобы отредактировать
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
