import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { KnowledgeItem, KnowledgeType } from "../types/trainingTypes";
import { KNOWLEDGE_TYPE_LABELS } from "../types/trainingTypes";

interface KnowledgeEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: KnowledgeItem | null;
  onSave: (data: Partial<KnowledgeItem>) => void;
  isPending: boolean;
}

export function KnowledgeEditorModal({ open, onOpenChange, item, onSave, isPending }: KnowledgeEditorModalProps) {
  const [type, setType] = useState<KnowledgeType>("OTHER");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  useEffect(() => {
    if (item) {
      setType(item.type as KnowledgeType);
      setTitle(item.title);
      setContent(item.content);
      setTagsInput(item.tags?.join(", ") || "");
    } else {
      setType("OTHER");
      setTitle("");
      setContent("");
      setTagsInput("");
    }
  }, [item, open]);

  function handleSubmit() {
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    onSave({
      ...(item ? { id: item.id } : {}),
      type,
      title: title.trim(),
      content: content.trim(),
      tags: tags.length > 0 ? tags : null,
    });
  }

  const isFormValid = title.trim().length > 0 && content.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-knowledge-editor">
        <DialogHeader>
          <DialogTitle>{item ? "Редактировать запись" : "Новая запись"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Тип</Label>
            <Select value={type} onValueChange={(v) => setType(v as KnowledgeType)}>
              <SelectTrigger data-testid="select-knowledge-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(KNOWLEDGE_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="knowledgeTitle">Заголовок</Label>
            <Input
              id="knowledgeTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название записи..."
              data-testid="input-knowledge-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="knowledgeContent">Содержание</Label>
            <Textarea
              id="knowledgeContent"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Текст записи для базы знаний..."
              rows={4}
              data-testid="textarea-knowledge-content"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="knowledgeTags">Теги (через запятую)</Label>
            <Input
              id="knowledgeTags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="тег1, тег2, тег3..."
              data-testid="input-knowledge-tags"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            data-testid="button-knowledge-cancel"
          >
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !isFormValid}
            data-testid="button-knowledge-save"
          >
            {isPending ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
