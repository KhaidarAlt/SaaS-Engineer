import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, MessageSquare } from "lucide-react";
import { startSession, sendMessage } from "../testing/api/testingApi";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export function QuickTestChatMini() {
  const [, navigate] = useLocation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [starting, setStarting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMut = useMutation({
    mutationFn: async (text: string) => {
      let sid = sessionId;
      if (!sid) {
        setStarting(true);
        const sess = await startSession("FREE_CHAT");
        sid = sess.sessionId;
        setSessionId(sid);
        setStarting(false);
      }
      return sendMessage(sid!, text);
    },
    onSuccess: (data, text) => {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: data.assistantMessage.content },
      ]);
      setInput("");
    },
  });

  function handleSend() {
    const text = input.trim();
    if (!text || sendMut.isPending) return;
    sendMut.mutate(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <Card className="p-5 flex flex-col" data-testid="card-quick-chat">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h3 className="text-sm font-semibold">Быстрый тест</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate("/dashboard/ai/rop/testing")}
          data-testid="button-open-full-testing"
        >
          <MessageSquare className="h-3 w-3 mr-1" />
          Тестирование
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-[160px] max-h-[200px] overflow-y-auto space-y-2 mb-3">
        {messages.length === 0 && !sendMut.isPending && (
          <p className="text-xs text-muted-foreground text-center py-8">
            Отправьте сообщение, чтобы протестировать AI-продавца
          </p>
        )}
        {messages.slice(-5).map((msg, i) => (
          <div
            key={i}
            className={`rounded-lg px-3 py-1.5 text-sm max-w-[85%] ${
              msg.role === "user"
                ? "bg-primary/10 ml-auto"
                : "bg-muted mr-auto"
            }`}
            data-testid={`quick-msg-${i}`}
          >
            {msg.content}
          </div>
        ))}
        {(sendMut.isPending || starting) && (
          <div className="bg-muted rounded-lg px-3 py-1.5 text-sm mr-auto flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-xs text-muted-foreground">Печатает...</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Напишите сообщение..."
          disabled={sendMut.isPending}
          data-testid="input-quick-chat"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || sendMut.isPending}
          data-testid="button-send-quick-chat"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
