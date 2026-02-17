import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AiTrigger, MatchType, ActionType } from "../types/trainingTypes";
import { MATCH_TYPE_LABELS, ACTION_TYPE_LABELS } from "../types/trainingTypes";

interface TriggerEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: AiTrigger | null;
  onSave: (data: Partial<AiTrigger>) => void;
  isPending: boolean;
}

const TEXT_ACTIONS: ActionType[] = ["ADD_LINE_TO_REPLY", "USE_SCRIPT_SNIPPET", "ASK_CLARIFYING_QUESTION"];
const REASON_ACTIONS: ActionType[] = ["FORCE_HANDOVER"];

export function TriggerEditorModal({ open, onOpenChange, trigger, onSave, isPending }: TriggerEditorModalProps) {
  const [isEnabled, setIsEnabled] = useState(true);
  const [priority, setPriority] = useState(100);
  const [matchType, setMatchType] = useState<MatchType>("KEYWORD");
  const [matchValue, setMatchValue] = useState("");
  const [actionType, setActionType] = useState<ActionType>("ADD_LINE_TO_REPLY");
  const [actionText, setActionText] = useState("");
  const [actionReason, setActionReason] = useState("");

  useEffect(() => {
    if (trigger) {
      setIsEnabled(trigger.isEnabled);
      setPriority(trigger.priority);
      setMatchType(trigger.matchType);
      setMatchValue(trigger.matchValue);
      setActionType(trigger.actionType);
      const payload = trigger.actionPayload as Record<string, string> | null;
      setActionText(payload?.text || "");
      setActionReason(payload?.reason || "");
    } else {
      setIsEnabled(true);
      setPriority(100);
      setMatchType("KEYWORD");
      setMatchValue("");
      setActionType("ADD_LINE_TO_REPLY");
      setActionText("");
      setActionReason("");
    }
  }, [trigger, open]);

  function handleSubmit() {
    const payload: Record<string, string> = {};
    if (TEXT_ACTIONS.includes(actionType)) {
      payload.text = actionText;
    }
    if (REASON_ACTIONS.includes(actionType)) {
      payload.reason = actionReason;
    }

    onSave({
      ...(trigger ? { id: trigger.id } : {}),
      isEnabled,
      priority: Math.max(1, Math.min(999, priority)),
      matchType,
      matchValue,
      actionType,
      actionPayload: Object.keys(payload).length > 0 ? payload : null,
    });
  }

  const isFormValid = matchValue.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-trigger-editor">
        <DialogHeader>
          <DialogTitle>{trigger ? "Редактировать триггер" : "Создать триггер"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="triggerEnabled">Активен</Label>
            <Switch
              id="triggerEnabled"
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
              data-testid="switch-trigger-enabled"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="triggerPriority">Приоритет (1-999)</Label>
            <Input
              id="triggerPriority"
              type="number"
              min={1}
              max={999}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              data-testid="input-trigger-priority"
            />
          </div>

          <div className="space-y-2">
            <Label>Тип совпадения</Label>
            <Select value={matchType} onValueChange={(v) => setMatchType(v as MatchType)}>
              <SelectTrigger data-testid="select-match-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MATCH_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="matchValue">Значение</Label>
            <Input
              id="matchValue"
              value={matchValue}
              onChange={(e) => setMatchValue(e.target.value)}
              placeholder="Введите ключевое слово или выражение..."
              data-testid="input-match-value"
            />
          </div>

          <div className="space-y-2">
            <Label>Действие</Label>
            <Select value={actionType} onValueChange={(v) => setActionType(v as ActionType)}>
              <SelectTrigger data-testid="select-action-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACTION_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {TEXT_ACTIONS.includes(actionType) && (
            <div className="space-y-2">
              <Label htmlFor="actionText">Текст действия</Label>
              <Textarea
                id="actionText"
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                placeholder="Текст для добавления в ответ..."
                rows={3}
                data-testid="textarea-action-text"
              />
            </div>
          )}

          {REASON_ACTIONS.includes(actionType) && (
            <div className="space-y-2">
              <Label htmlFor="actionReason">Причина передачи</Label>
              <Input
                id="actionReason"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Укажите причину..."
                data-testid="input-action-reason"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            data-testid="button-trigger-cancel"
          >
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !isFormValid}
            data-testid="button-trigger-save"
          >
            {isPending ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
