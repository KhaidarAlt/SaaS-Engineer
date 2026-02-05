import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  Bot, 
  User,
  LifeBuoy,
  BarChart3,
  Megaphone,
  Briefcase,
  Wallet,
  Loader2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/DashboardLayout";

interface ConsultantMode {
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface QuickTemplate {
  id: string;
  label: string;
  prompt: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MODE_ICONS: Record<string, typeof BarChart3> = {
  analyst: BarChart3,
  marketer: Megaphone,
  rop: Briefcase,
  finance: Wallet,
  support: LifeBuoy,
};

export default function BusinessConsultantPage() {
  const [selectedMode, setSelectedMode] = useState<string>("support");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: modesData, isLoading: modesLoading } = useQuery<{
    modes: ConsultantMode[];
    quickTemplates: QuickTemplate[];
  }>({
    queryKey: ["/api/consultant/modes"],
  });

  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const res = await apiRequest("POST", "/api/consultant/chat", {
        mode: selectedMode,
        messages: messages,
        userMessage,
      });
      return res.json();
    },
    onSuccess: (data: { response: string; suggestedActions?: string[] }) => {
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
    },
    onError: () => {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Произошла ошибка. Пожалуйста, попробуйте ещё раз." 
      }]);
    },
  });

  const handleSend = () => {
    if (!inputMessage.trim() || chatMutation.isPending) return;
    
    const userMsg = inputMessage.trim();
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setInputMessage("");
    chatMutation.mutate(userMsg);
  };

  const handleQuickTemplate = (prompt: string) => {
    setMessages(prev => [...prev, { role: "user", content: prompt }]);
    chatMutation.mutate(prompt);
  };

  const handleModeChange = (modeId: string) => {
    setSelectedMode(modeId);
    setMessages([]);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const modes = modesData?.modes || [];
  const quickTemplates = modesData?.quickTemplates || [];

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <div className="border-b p-4">
          <h1 className="text-2xl font-semibold mb-4">Бизнес-консультант</h1>
          
          <div className="flex flex-wrap gap-2">
            {modesLoading ? (
              Array(5).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-10 w-32" />
              ))
            ) : (
              modes.map((mode) => {
                const Icon = MODE_ICONS[mode.id] || Bot;
                const isSupport = mode.id === "support";
                return (
                  <Button
                    key={mode.id}
                    variant={selectedMode === mode.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleModeChange(mode.id)}
                    className={cn(
                      "gap-2",
                      isSupport && selectedMode !== mode.id && "border-primary text-primary"
                    )}
                    data-testid={`mode-${mode.id}`}
                  >
                    <Icon className="h-4 w-4" />
                    {mode.name}
                  </Button>
                );
              })
            )}
          </div>
          
          {selectedMode && modes.find(m => m.id === selectedMode) && (
            <p className="text-sm text-muted-foreground mt-2">
              {modes.find(m => m.id === selectedMode)?.description}
            </p>
          )}
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {selectedMode === "support" 
                      ? "Поддержка SmartCatalog" 
                      : "Бизнес-консультант"}
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {selectedMode === "support"
                      ? "Задайте вопрос о функционале платформы"
                      : "Задайте вопрос о вашем бизнесе"}
                  </p>
                  
                  <div className="flex flex-wrap justify-center gap-2">
                    {quickTemplates.map((template) => (
                      <Button
                        key={template.id}
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickTemplate(template.prompt)}
                        data-testid={`template-${template.id}`}
                      >
                        {template.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex gap-3",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-3",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))
              )}
              
              {chatMutation.isPending && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-muted-foreground">Думаю...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t p-4">
            <div className="max-w-3xl mx-auto flex gap-2">
              <Textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Введите сообщение..."
                className="min-h-[44px] max-h-32 resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                data-testid="input-message"
              />
              <Button
                onClick={handleSend}
                disabled={!inputMessage.trim() || chatMutation.isPending}
                size="icon"
                data-testid="button-send"
              >
                {chatMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
