import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, Pencil, GraduationCap, BookPlus, Send, X } from "lucide-react";
import type { FeedbackAction } from "../types/testingTypes";

interface MessageActionsProps {
  messageId: string;
  onFeedback: (
    messageId: string,
    action: FeedbackAction,
    editedText?: string
  ) => void;
  currentFeedback?: string;
}

const actions: Array<{
  action: FeedbackAction;
  icon: typeof ThumbsUp;
  label: string;
  activeClass: string;
}> = [
  { action: "APPROVE", icon: ThumbsUp, label: "Одобрить", activeClass: "text-green-600 dark:text-green-400" },
  { action: "IMPROVE", icon: Pencil, label: "Улучшить", activeClass: "text-blue-600 dark:text-blue-400" },
  { action: "TRAIN", icon: GraduationCap, label: "Обучить", activeClass: "text-purple-600 dark:text-purple-400" },
  { action: "ADD_TO_KB", icon: BookPlus, label: "В базу знаний", activeClass: "text-amber-600 dark:text-amber-400" },
];

export function MessageActions({
  messageId,
  onFeedback,
  currentFeedback,
}: MessageActionsProps) {
  const [showEditor, setShowEditor] = useState(false);
  const [editText, setEditText] = useState("");

  const handleAction = (action: FeedbackAction) => {
    if (action === "IMPROVE") {
      setShowEditor(true);
      return;
    }
    onFeedback(messageId, action);
  };

  const handleSubmitEdit = () => {
    if (editText.trim()) {
      onFeedback(messageId, "IMPROVE", editText.trim());
      setShowEditor(false);
      setEditText("");
    }
  };

  return (
    <div data-testid="message-actions" className="mt-1 space-y-1">
      <div className="flex items-center gap-0.5 flex-wrap">
        {actions.map(({ action, icon: Icon, label, activeClass }) => (
          <Button
            key={action}
            data-testid={`action-${action.toLowerCase()}-${messageId}`}
            size="icon"
            variant="ghost"
            title={label}
            onClick={() => handleAction(action)}
            className={cn(
              currentFeedback === action && activeClass
            )}
          >
            <Icon className="w-3.5 h-3.5" />
          </Button>
        ))}
        {currentFeedback && (
          <span
            data-testid={`feedback-indicator-${messageId}`}
            className="text-[10px] text-muted-foreground ml-1"
          >
            {actions.find((a) => a.action === currentFeedback)?.label}
          </span>
        )}
      </div>

      {showEditor && (
        <div className="flex flex-col gap-1">
          <Textarea
            data-testid={`edit-textarea-${messageId}`}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="Введите исправленный текст..."
            className="text-xs min-h-[60px] resize-none"
          />
          <div className="flex items-center gap-1 flex-wrap">
            <Button
              data-testid={`submit-edit-${messageId}`}
              size="sm"
              variant="default"
              onClick={handleSubmitEdit}
              disabled={!editText.trim()}
            >
              <Send className="w-3 h-3" />
              Отправить
            </Button>
            <Button
              data-testid={`cancel-edit-${messageId}`}
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowEditor(false);
                setEditText("");
              }}
            >
              <X className="w-3 h-3" />
              Отмена
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
