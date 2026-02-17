import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ShieldOff, X } from "lucide-react";
import type { AiAntiPattern, PatternType } from "../types/trainingTypes";

const PATTERN_TYPE_LABELS: Record<PatternType, string> = {
  KEYWORD: "Ключевое слово",
  REGEX: "Регулярное выражение",
  CLAIM: "Утверждение",
};

interface AntiPatternPanelProps {
  patterns: AiAntiPattern[];
  isLoading?: boolean;
  onCreate: (data: { patternType: PatternType; patternValue: string; note: string }) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}

export function AntiPatternPanel({ patterns, isLoading, onCreate, onDelete, onToggle }: AntiPatternPanelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [patternType, setPatternType] = useState<PatternType>("KEYWORD");
  const [patternValue, setPatternValue] = useState("");
  const [note, setNote] = useState("");

  function handleSave() {
    if (!patternValue.trim()) return;
    onCreate({
      patternType,
      patternValue: patternValue.trim(),
      note: note.trim(),
    });
    setPatternType("KEYWORD");
    setPatternValue("");
    setNote("");
    setIsAdding(false);
  }

  function handleCancel() {
    setIsAdding(false);
    setPatternType("KEYWORD");
    setPatternValue("");
    setNote("");
  }

  return (
    <div className="space-y-4" data-testid="anti-pattern-panel">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldOff className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-base font-semibold">Анти-паттерны</h3>
        </div>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} data-testid="button-add-anti-pattern">
            <Plus className="h-4 w-4" />
            Добавить запрет
          </Button>
        )}
      </div>

      {isAdding && (
        <Card className="p-4 space-y-3" data-testid="card-add-anti-pattern">
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={patternType} onValueChange={(v) => setPatternType(v as PatternType)}>
              <SelectTrigger className="w-[200px]" data-testid="select-pattern-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PATTERN_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={patternValue}
              onChange={(e) => setPatternValue(e.target.value)}
              placeholder="Значение паттерна..."
              className="flex-1 min-w-[200px]"
              data-testid="input-pattern-value"
            />
          </div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Заметка (необязательно)..."
            data-testid="input-pattern-note"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!patternValue.trim()}
              data-testid="button-save-anti-pattern"
            >
              Сохранить
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              data-testid="button-cancel-anti-pattern"
            >
              <X className="h-4 w-4" />
              Отмена
            </Button>
          </div>
        </Card>
      )}

      {patterns.length === 0 && !isAdding ? (
        <Card className="p-8 flex flex-col items-center gap-3 text-center" data-testid="empty-anti-patterns">
          <ShieldOff className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Нет запретов. Добавьте анти-паттерны, чтобы AI не использовал нежелательные фразы или утверждения.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {patterns.map((pattern) => (
            <Card
              key={pattern.id}
              className="p-3 flex items-center justify-between gap-3 flex-wrap"
              data-testid={`card-anti-pattern-${pattern.id}`}
            >
              <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                <Badge variant="destructive" className="shrink-0">
                  {PATTERN_TYPE_LABELS[pattern.patternType] || pattern.patternType}
                </Badge>
                <span className="text-sm" data-testid={`text-pattern-value-${pattern.id}`}>
                  {pattern.patternValue}
                </span>
                {pattern.note && (
                  <span className="text-xs text-muted-foreground truncate">
                    {pattern.note}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={pattern.isActive}
                  onCheckedChange={() => onToggle(pattern.id)}
                  data-testid={`switch-anti-pattern-${pattern.id}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(pattern.id)}
                  data-testid={`button-delete-anti-pattern-${pattern.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
