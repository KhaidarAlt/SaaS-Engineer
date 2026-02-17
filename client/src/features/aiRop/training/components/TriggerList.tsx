import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, ArrowRight, Search, Settings2 } from "lucide-react";
import type { AiTrigger } from "../types/trainingTypes";
import { MATCH_TYPE_LABELS, ACTION_TYPE_LABELS } from "../types/trainingTypes";

interface TriggerListProps {
  triggers: AiTrigger[];
  isLoading?: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (trigger: AiTrigger) => void;
  onCreate: () => void;
}

export function TriggerList({ triggers, isLoading, onToggle, onDelete, onEdit, onCreate }: TriggerListProps) {
  const [search, setSearch] = useState("");

  const filtered = triggers.filter((t) =>
    t.matchValue.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4" data-testid="trigger-list">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск триггеров..."
            className="pl-9"
            data-testid="input-trigger-search"
          />
        </div>
        <Button onClick={onCreate} data-testid="button-create-trigger">
          <Plus className="h-4 w-4" />
          Создать триггер
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 flex flex-col items-center gap-3 text-center" data-testid="empty-triggers">
          <Settings2 className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {search ? "Триггеры не найдены" : "Нет триггеров. Создайте первый триггер для автоматизации ответов AI."}
          </p>
          {!search && (
            <Button variant="outline" size="sm" onClick={onCreate} data-testid="button-create-trigger-empty">
              <Plus className="h-4 w-4" />
              Создать триггер
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((trigger) => (
            <Card
              key={trigger.id}
              className="p-3 flex items-center justify-between gap-3 flex-wrap"
              data-testid={`card-trigger-${trigger.id}`}
            >
              <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                <Badge variant="secondary" className="shrink-0">
                  {MATCH_TYPE_LABELS[trigger.matchType] || trigger.matchType}
                </Badge>
                <span className="text-sm truncate" data-testid={`text-match-value-${trigger.id}`}>
                  {trigger.matchValue}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <Badge variant="outline" className="shrink-0">
                  {ACTION_TYPE_LABELS[trigger.actionType] || trigger.actionType}
                </Badge>
                <span className="text-xs text-muted-foreground shrink-0">
                  #{trigger.priority}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={trigger.isEnabled}
                  onCheckedChange={() => onToggle(trigger.id)}
                  data-testid={`switch-trigger-${trigger.id}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(trigger)}
                  data-testid={`button-edit-trigger-${trigger.id}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(trigger.id)}
                  data-testid={`button-delete-trigger-${trigger.id}`}
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
