import { useState } from "react";
import { Wand2, Loader2, Sparkles, FileText, Scissors, TrendingUp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const STYLES = [
  { id: "selling", label: "Продающий", icon: TrendingUp },
  { id: "informative", label: "Информативный", icon: FileText },
  { id: "marketplace", label: "Для маркетплейса", icon: Sparkles },
  { id: "trustful", label: "Доверительный", icon: Check },
  { id: "short", label: "Короткий", icon: Scissors },
  { id: "expert", label: "Экспертный", icon: Wand2 },
];

const OPTIONS = [
  { id: "bullets", label: "Добавить преимущества списком" },
  { id: "objections", label: "Закрыть частые возражения" },
  { id: "benefits", label: "Сделать упор на выгоды" },
  { id: "scenarios", label: "Добавить сценарии использования" },
  { id: "shorter", label: "Сделать текст короче" },
];

interface AiDescriptionGeneratorProps {
  productName: string;
  category?: string;
  price?: string;
  currentText?: string;
  onInsert: (text: string) => void;
}

export function AiDescriptionGenerator({
  productName,
  category,
  price,
  currentText,
  onInsert,
}: AiDescriptionGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [style, setStyle] = useState("selling");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState("");
  const [generatedBullets, setGeneratedBullets] = useState<string[]>([]);
  const { toast } = useToast();

  const toggleOption = (optionId: string) => {
    setSelectedOptions(prev =>
      prev.includes(optionId)
        ? prev.filter(o => o !== optionId)
        : [...prev, optionId]
    );
  };

  const generate = async (action?: string) => {
    if (!productName.trim()) {
      toast({
        title: "Заполните название товара для генерации описания",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const res = await apiRequest("POST", "/api/products/generate-description", {
        name: productName,
        category,
        price,
        currentText: currentText || undefined,
        style,
        options: selectedOptions,
        action: action || "generate",
      });
      const result = await res.json();

      setGeneratedText(result.description || "");
      setGeneratedBullets(result.bullets || []);
    } catch (error: any) {
      toast({
        title: error.message || "Ошибка генерации",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInsert = () => {
    let text = generatedText;
    if (generatedBullets.length > 0) {
      text += "\n\n" + generatedBullets.map(b => `• ${b}`).join("\n");
    }
    onInsert(text);
    setGeneratedText("");
    setGeneratedBullets([]);
    toast({ title: "Описание вставлено" });
  };

  if (!isOpen) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-1.5"
        data-testid="button-ai-description-open"
      >
        <Wand2 className="h-3.5 w-3.5" />
        Сгенерировать ИИ
      </Button>
    );
  }

  return (
    <Card className="mt-2">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Генератор описаний ИИ</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            data-testid="button-ai-description-close"
          >
            Свернуть
          </Button>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Стиль текста</Label>
          <div className="flex flex-wrap gap-1.5">
            {STYLES.map(s => (
              <Badge
                key={s.id}
                variant={style === s.id ? "default" : "outline"}
                className={`cursor-pointer toggle-elevate ${style === s.id ? "toggle-elevated" : ""}`}
                onClick={() => setStyle(s.id)}
                data-testid={`badge-style-${s.id}`}
              >
                <s.icon className="h-3 w-3 mr-1" />
                {s.label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Опции</Label>
          <div className="flex flex-wrap gap-1.5">
            {OPTIONS.map(opt => (
              <Badge
                key={opt.id}
                variant={selectedOptions.includes(opt.id) ? "default" : "outline"}
                className={`cursor-pointer toggle-elevate ${selectedOptions.includes(opt.id) ? "toggle-elevated" : ""}`}
                onClick={() => toggleOption(opt.id)}
                data-testid={`badge-option-${opt.id}`}
              >
                {opt.label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => generate("generate")}
            disabled={isGenerating}
            data-testid="button-ai-generate"
          >
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
            Сгенерировать
          </Button>
          {currentText && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => generate("improve")}
                disabled={isGenerating}
                data-testid="button-ai-improve"
              >
                Улучшить текущий
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => generate("shorter")}
                disabled={isGenerating}
                data-testid="button-ai-shorter"
              >
                Сделать короче
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => generate("more_selling")}
                disabled={isGenerating}
                data-testid="button-ai-more-selling"
              >
                Более продающий
              </Button>
            </>
          )}
        </div>

        {generatedText && (
          <div className="space-y-3 rounded-md border p-3">
            <Label className="text-xs text-muted-foreground">Результат</Label>
            <p className="text-sm whitespace-pre-wrap">{generatedText}</p>
            {generatedBullets.length > 0 && (
              <ul className="text-sm space-y-1">
                {generatedBullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-0.5">•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleInsert}
                data-testid="button-ai-insert"
              >
                <Check className="h-3.5 w-3.5 mr-1.5" />
                Вставить в описание
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => generate("generate")}
                disabled={isGenerating}
                data-testid="button-ai-regenerate"
              >
                {isGenerating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                Другой вариант
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
