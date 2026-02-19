import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Zap, Lightbulb, MessageSquare, ChevronRight, MousePointerClick } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { QuickTrainRequest, RecentTestMessage, ApplyMode } from "../types/trainingTypes";

const EXAMPLE_SCENARIOS = [
  {
    id: "price_objection",
    label: "Дорого!",
    userText: "Почему так дорого? У конкурентов дешевле",
    assistantText: "Понимаю ваше сомнение. Давайте посмотрим другие варианты подешевле.",
    editedText: "Понимаю! Наша цена включает гарантию 2 года и бесплатную доставку. Также у нас есть рассрочка на 3 месяца без переплаты. Хотите расскажу подробнее?",
  },
  {
    id: "delivery",
    label: "Доставка",
    userText: "А вы доставляете? Сколько стоит доставка?",
    assistantText: "Да, мы доставляем.",
    editedText: "Да, доставляем по всему Казахстану! По городу доставка бесплатная при заказе от 10 000 тг. В другие города — через Kaspi Доставку за 1-3 дня. Какой у вас город?",
  },
  {
    id: "competitor",
    label: "Сравнение",
    userText: "А чем вы лучше других магазинов?",
    assistantText: "У нас хорошие товары и цены.",
    editedText: "Наши преимущества: оригинальные товары с сертификатами, гарантия возврата 14 дней, бесплатная консультация и быстрая доставка. Многие клиенты выбирают нас именно за надёжность. Что для вас важнее всего при выборе?",
  },
  {
    id: "not_sure",
    label: "Сомневаюсь",
    userText: "Я пока не уверен, мне надо подумать",
    assistantText: "Хорошо, подумайте и напишите когда решите.",
    editedText: "Конечно, не торопитесь! Могу я уточнить, что именно вызывает сомнения? Может быть я смогу помочь с выбором. Кстати, сейчас на этот товар действует скидка — она заканчивается через 2 дня.",
  },
  {
    id: "wrong_topic",
    label: "Не по теме",
    userText: "Какая сейчас погода в Алматы?",
    assistantText: "Сейчас в Алматы солнечно, температура около 25 градусов.",
    editedText: "Я AI-помощник магазина и могу помочь с выбором товаров, ценами, доставкой и оплатой. Чем могу помочь по нашему каталогу?",
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
  const [showExamples, setShowExamples] = useState(true);

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

  function handleSelectExample(example: typeof EXAMPLE_SCENARIOS[0]) {
    setUserText(example.userText);
    setAssistantText(example.assistantText);
    setEditedText(example.editedText);
    setShowExamples(false);
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
            <p className="text-xs text-muted-foreground">Напишите вопрос клиента, на который AI ответил плохо</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
            <p className="text-xs text-muted-foreground">Напишите правильный ответ, как AI должен был ответить</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
            <p className="text-xs text-muted-foreground">Нажмите "Обучить AI" — он запомнит и будет отвечать правильно</p>
          </div>
        </div>
      </div>

      {showExamples && !hasContent && (
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
            onChange={(e) => setUserText(e.target.value)}
            placeholder={'Например: "Почему так дорого?" или "Есть доставка в Караганду?"'}
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
              placeholder={'Необязательно. Вставьте текущий ответ AI, если хотите сравнить'}
              rows={2}
              data-testid="textarea-assistant-text"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editedText">Как должно быть (исправление)</Label>
            <Textarea
              id="editedText"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              placeholder={'Например: "Цена включает гарантию 2 года и бесплатную доставку. Есть рассрочка!"'}
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
