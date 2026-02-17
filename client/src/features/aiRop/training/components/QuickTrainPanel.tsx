import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Zap, Lightbulb, MessageSquare } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { QuickTrainRequest, RecentTestMessage, ApplyMode } from "../types/trainingTypes";

interface QuickTrainPanelProps {
  recentMessages: RecentTestMessage[];
  onQuickTrain: (data: QuickTrainRequest) => void;
  isPending: boolean;
}

export function QuickTrainPanel({ recentMessages, onQuickTrain, isPending }: QuickTrainPanelProps) {
  const [userText, setUserText] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [editedText, setEditedText] = useState("");

  const showPriceHint = userText.toLowerCase().includes("дорого");

  function handleAction(mode: ApplyMode) {
    if (!userText.trim() || !editedText.trim()) return;
    onQuickTrain({
      userText: userText.trim(),
      assistantText: assistantText.trim(),
      editedText: editedText.trim(),
      applyMode: mode,
    });
  }

  function handleSelectMessage(msg: RecentTestMessage) {
    if (msg.role === "user") {
      setUserText(msg.content);
    } else {
      setAssistantText(msg.content);
      setEditedText(msg.content);
    }
  }

  const isDisabled = isPending || !userText.trim() || !editedText.trim();

  return (
    <Card className="p-4 space-y-4" data-testid="card-quick-train">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-base font-semibold">Быстрое обучение</h3>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-from-testing">
              <MessageSquare className="h-4 w-4" />
              Из тестирования
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-60 overflow-y-auto">
            {recentMessages.length === 0 ? (
              <DropdownMenuItem disabled>Нет сообщений</DropdownMenuItem>
            ) : (
              recentMessages.map((msg) => (
                <DropdownMenuItem
                  key={msg.id}
                  onClick={() => handleSelectMessage(msg)}
                  data-testid={`menu-item-message-${msg.id}`}
                >
                  <Badge variant="outline" className="mr-2 shrink-0">
                    {msg.role === "user" ? "Клиент" : "AI"}
                  </Badge>
                  <span className="truncate text-sm">{msg.content.slice(0, 80)}</span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="userText">Сообщение клиента</Label>
          <Textarea
            id="userText"
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            placeholder="Введите сообщение клиента..."
            rows={5}
            data-testid="textarea-user-text"
          />
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="assistantText">Ответ AI (как было)</Label>
            <Textarea
              id="assistantText"
              value={assistantText}
              onChange={(e) => setAssistantText(e.target.value)}
              placeholder="Текущий ответ AI..."
              rows={2}
              readOnly
              className="opacity-70"
              data-testid="textarea-assistant-text"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editedText">Как должно быть (исправление)</Label>
            <Textarea
              id="editedText"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              placeholder="Напишите правильный ответ..."
              rows={3}
              data-testid="textarea-edited-text"
            />
          </div>
        </div>
      </div>

      {showPriceHint && (
        <div className="flex items-start gap-2 rounded-md bg-muted p-3" data-testid="hint-price-objection">
          <Lightbulb className="h-4 w-4 mt-0.5 text-yellow-500 shrink-0" />
          <p className="text-sm text-muted-foreground">
            Совет: Обработайте возражение по цене — предложите рассрочку или обоснуйте ценность
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          disabled={isDisabled}
          onClick={() => handleAction("FIX_ONLY")}
          data-testid="button-fix-only"
        >
          Только здесь
        </Button>
        <Button
          variant="default"
          size="sm"
          disabled={isDisabled}
          onClick={() => handleAction("TRAIN_FUTURE")}
          data-testid="button-train-future"
        >
          Обучить AI
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isDisabled}
          onClick={() => handleAction("ADD_TO_KB")}
          data-testid="button-add-to-kb"
        >
          В базу знаний
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={isDisabled}
          onClick={() => handleAction("ANTI_PATTERN")}
          data-testid="button-anti-pattern"
        >
          Запретить
        </Button>
      </div>
    </Card>
  );
}
