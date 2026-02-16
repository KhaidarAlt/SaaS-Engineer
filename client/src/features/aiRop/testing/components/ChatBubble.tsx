import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Bot } from "lucide-react";
import { motion } from "framer-motion";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  isSimulated?: boolean;
  children?: React.ReactNode;
}

export function ChatBubble({
  role,
  content,
  timestamp,
  isSimulated,
  children,
}: ChatBubbleProps) {
  const isUser = role === "user";

  return (
    <motion.div
      data-testid={`chat-bubble-${role}`}
      initial={{ opacity: 0, x: isUser ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "relative max-w-[85%] rounded-lg px-3 py-2",
          isUser
            ? "bg-[#DCF8C6] dark:bg-[#005C4B] text-gray-900 dark:text-gray-100"
            : "bg-white dark:bg-[#1F2C34] text-gray-900 dark:text-gray-100"
        )}
      >
        {isSimulated && isUser && (
          <Badge
            variant="secondary"
            className="no-default-hover-elevate mb-1 text-[10px] gap-1"
          >
            <Bot className="w-3 h-3" />
            Симуляция
          </Badge>
        )}

        <p className="text-sm whitespace-pre-wrap break-words">{content}</p>

        {timestamp && (
          <p
            data-testid="chat-bubble-timestamp"
            className={cn(
              "text-[10px] text-right mt-1",
              isUser
                ? "text-gray-600 dark:text-gray-400"
                : "text-gray-500 dark:text-gray-400"
            )}
          >
            {timestamp}
          </p>
        )}

        {children}
      </div>
    </motion.div>
  );
}
