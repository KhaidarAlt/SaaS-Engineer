import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FreeChatPanelProps {
  onSendHint: (text: string) => void;
}

const HINTS = [
  "Сколько стоит?",
  "Есть скидка?",
  "Как оплатить?",
  "Какая гарантия?",
  "Есть доставка?",
  "Хочу дешевле",
  "Дайте менеджера",
  "Готов купить",
];

export default function FreeChatPanel({ onSendHint }: FreeChatPanelProps) {
  return (
    <Card data-testid="card-free-chat">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageCircle className="text-muted-foreground" />
          Подсказки для тестирования
        </CardTitle>
        <CardDescription>
          Попробуйте задать AI-продавцу типичные вопросы клиентов
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {HINTS.map((hint, i) => (
            <motion.div
              key={hint}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Badge
                variant="outline"
                className="cursor-pointer select-none"
                onClick={() => onSendHint(hint)}
                data-testid={`badge-hint-${i}`}
              >
                {hint}
              </Badge>
            </motion.div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Нажмите на подсказку или напишите свой вопрос в чате
        </p>
      </CardContent>
    </Card>
  );
}
