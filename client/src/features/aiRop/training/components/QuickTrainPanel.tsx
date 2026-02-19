import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Zap, Lightbulb, MessageSquare, ChevronRight, MousePointerClick, Send, RefreshCw, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { previewResponse, regenerateImproved } from "../api/trainingApi";
import type { QuickTrainRequest, RecentTestMessage, ApplyMode } from "../types/trainingTypes";

const EXAMPLE_SCENARIOS = [
  {
    id: "price_objection",
    label: "Дорого!",
    userText: "Почему так дорого? У конкурентов дешевле",
  },
  {
    id: "delivery",
    label: "Доставка",
    userText: "А вы доставляете? Сколько стоит доставка?",
  },
  {
    id: "competitor",
    label: "Сравнение",
    userText: "А чем вы лучше других магазинов?",
  },
  {
    id: "not_sure",
    label: "Сомневаюсь",
    userText: "Я пока не уверен, мне надо подумать",
  },
  {
    id: "wrong_topic",
    label: "Не по теме",
    userText: "Какая сейчас погода в Алматы?",
  },
];

interface QuickTrainPanelProps {
  recentMessages: RecentTestMessage[];
  onQuickTrain: (data: QuickTrainRequest) => void;
  isPending: boolean;
}

export function QuickTrainPanel({ recentMessages, onQuickTrain, isPending }: QuickTrainPanelProps) {
  const [userText, setUserText] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [editedText, setEditedText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [currentResponseRef, setCurrentResponseRef] = useState("");

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

  async function handlePreview() {
    if (!userText.trim() || isGenerating) return;
    setIsGenerating(true);
    setAssistantText("");
    setEditedText("");
    try {
      const result = await previewResponse(userText.trim());
      setAssistantText(result.currentResponse);
      setEditedText(result.improvedResponse);
      setCurrentResponseRef(result.currentResponse);
      setHasGenerated(true);
    } catch {
      setAssistantText("Ошибка генерации. Попробуйте ещё раз.");
      setEditedText("Напишите свой вариант правильного ответа вручную");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRegenerate() {
    if (!userText.trim() || !currentResponseRef.trim() || isRegenerating) return;
    setIsRegenerating(true);
    try {
      const result = await regenerateImproved(userText.trim(), currentResponseRef.trim());
      setEditedText(result.improvedResponse);
    } catch {
      // keep current text on error
    } finally {
      setIsRegenerating(false);
    }
  }

  function handleSelectExample(example: typeof EXAMPLE_SCENARIOS[0]) {
    setUserText(example.userText);
    setAssistantText("");
    setEditedText("");
    setHasGenerated(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handlePreview();
    }
  }

  const isDisabled = isPending || !userText.trim() || !editedText.trim();
  const hasContent = userText.trim() || assistantText.trim() || editedText.trim();

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

      <div className="rounded-md border bg-muted/50 p-3 space-y-2" data-testid="section-how-it-works">
        <p className="text-sm font-medium text-muted-foreground">Как это работает:</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
            <p className="text-xs text-muted-foreground">Напишите вопрос клиента и нажмите "Получить ответ AI"</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
            <p className="text-xs text-muted-foreground">Посмотрите текущий и улучшенный ответ, отредактируйте при необходимости</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
            <p className="text-xs text-muted-foreground">Нажмите "Обучить AI" — он запомнит и будет отвечать правильно</p>
          </div>
        </div>
      </div>

      {!hasContent && (
        <div className="space-y-2" data-testid="section-examples">
          <div className="flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Попробуйте на примере — нажмите:</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_SCENARIOS.map((example) => (
              <Button
                key={example.id}
                variant="outline"
                size="sm"
                onClick={() => handleSelectExample(example)}
                data-testid={`button-example-${example.id}`}
              >
                {example.label}
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="userText">Сообщение клиента</Label>
          <Textarea
            id="userText"
            value={userText}
            onChange={(e) => { setUserText(e.target.value); setHasGenerated(false); }}
            onKeyDown={handleKeyDown}
            placeholder={'Например: "Почему так дорого?" или "Есть доставка в Караганду?"'}
            rows={5}
            data-testid="textarea-user-text"
          />
          <Button
            className="w-full"
            onClick={handlePreview}
            disabled={!userText.trim() || isGenerating}
            data-testid="button-preview-response"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                AI думает...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Получить ответ AI
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center">или нажмите Ctrl+Enter</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="assistantText">Ответ AI (как было)</Label>
            <Textarea
              id="assistantText"
              value={assistantText}
              onChange={(e) => setAssistantText(e.target.value)}
              placeholder={isGenerating ? "Генерация ответа..." : "Нажмите 'Получить ответ AI' слева"}
              rows={2}
              className={isGenerating ? "animate-pulse" : ""}
              data-testid="textarea-assistant-text"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label htmlFor="editedText">Как должно быть (исправление)</Label>
              {hasGenerated && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={isRegenerating || !currentResponseRef.trim()}
                  data-testid="button-regenerate"
                >
                  {isRegenerating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Другой вариант
                </Button>
              )}
            </div>
            <Textarea
              id="editedText"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              placeholder={isGenerating ? "Генерация улучшенного ответа..." : 'Здесь появится улучшенный вариант, который можно отредактировать'}
              rows={3}
              className={isGenerating || isRegenerating ? "animate-pulse" : ""}
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isDisabled}
              onClick={() => handleAction("FIX_ONLY")}
              data-testid="button-fix-only"
            >
              Только здесь
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs max-w-xs">Исправить ответ только в этом конкретном диалоге</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="sm"
              disabled={isDisabled}
              onClick={() => handleAction("TRAIN_FUTURE")}
              data-testid="button-train-future"
            >
              Обучить AI
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs max-w-xs">AI запомнит и будет отвечать так на похожие вопросы в будущем</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isDisabled}
              onClick={() => handleAction("ADD_TO_KB")}
              data-testid="button-add-to-kb"
            >
              В базу знаний
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs max-w-xs">Сохранить как правило в базу знаний для постоянного использования</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDisabled}
              onClick={() => handleAction("ANTI_PATTERN")}
              data-testid="button-anti-pattern"
            >
              Запретить
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs max-w-xs">Запретить AI отвечать подобным образом</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </Card>
  );
}
