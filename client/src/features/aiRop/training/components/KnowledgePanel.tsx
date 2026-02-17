import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search, Download, BookOpen } from "lucide-react";
import type { KnowledgeItem } from "../types/trainingTypes";
import { KNOWLEDGE_TYPE_LABELS } from "../types/trainingTypes";

interface KnowledgePanelProps {
  items: KnowledgeItem[];
  isLoading?: boolean;
  onEdit: (item: KnowledgeItem) => void;
  onDelete: (id: string) => void;
  onImport: () => void;
  isImporting: boolean;
  onCreate: () => void;
}

export function KnowledgePanel({ items, isLoading, onEdit, onDelete, onImport, isImporting, onCreate }: KnowledgePanelProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const filtered = items.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.content.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "ALL" || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-4" data-testid="knowledge-panel">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по базе знаний..."
            className="pl-9"
            data-testid="input-knowledge-search"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-knowledge-type-filter">
            <SelectValue placeholder="Все типы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Все типы</SelectItem>
            {Object.entries(KNOWLEDGE_TYPE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={onImport}
          disabled={isImporting}
          data-testid="button-import-catalog"
        >
          <Download className="h-4 w-4" />
          {isImporting ? "Импорт..." : "Импорт из каталога"}
        </Button>
        <Button onClick={onCreate} data-testid="button-create-knowledge">
          <Plus className="h-4 w-4" />
          Добавить
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 flex flex-col items-center gap-3 text-center" data-testid="empty-knowledge">
          <BookOpen className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {search || typeFilter !== "ALL"
              ? "Ничего не найдено"
              : "База знаний пуста. Импортируйте данные из каталога или добавьте записи вручную."}
          </p>
          {!search && typeFilter === "ALL" && (
            <Button variant="outline" size="sm" onClick={onImport} disabled={isImporting} data-testid="button-import-empty">
              <Download className="h-4 w-4" />
              Импорт из каталога
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((item) => (
            <Card
              key={item.id}
              className="p-4 space-y-3"
              data-testid={`card-knowledge-${item.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-medium truncate" data-testid={`text-knowledge-title-${item.id}`}>
                      {item.title}
                    </h4>
                    <Badge variant="secondary">
                      {KNOWLEDGE_TYPE_LABELS[item.type] || item.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3" data-testid={`text-knowledge-content-${item.id}`}>
                    {item.content.length > 120 ? `${item.content.slice(0, 120)}...` : item.content}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Активна</span>
                  <Switch
                    checked={item.isActive !== false}
                    disabled
                    data-testid={`switch-knowledge-${item.id}`}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(item)}
                    data-testid={`button-edit-knowledge-${item.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(item.id)}
                    data-testid={`button-delete-knowledge-${item.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
