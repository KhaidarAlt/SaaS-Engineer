import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Lightbulb } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MicroEvaluationBarProps {
  score: number;
  positives: string[];
  issues: string[];
  suggestions: string[];
  expanded?: boolean;
}

function getScoreColor(score: number) {
  if (score >= 7) return "bg-green-600 text-white";
  if (score >= 4) return "bg-yellow-500 text-white";
  return "bg-red-500 text-white";
}

export function MicroEvaluationBar({
  score,
  positives,
  issues,
  suggestions,
  expanded: initialExpanded = false,
}: MicroEvaluationBarProps) {
  const [expanded, setExpanded] = useState(initialExpanded);

  return (
    <div data-testid="micro-evaluation-bar" className="mt-1">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          data-testid="micro-evaluation-score"
          className={cn("no-default-hover-elevate text-[11px]", getScoreColor(score))}
        >
          {score}/10
        </Badge>
        <Button
          data-testid="micro-evaluation-toggle"
          size="icon"
          variant="ghost"
          onClick={() => setExpanded(!expanded)}
          className="w-6 h-6"
        >
          {expanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </Button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1.5 text-xs">
              {positives.length > 0 && (
                <div className="space-y-0.5">
                  {positives.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-green-700 dark:text-green-400">
                      <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
              {issues.length > 0 && (
                <div className="space-y-0.5">
                  {issues.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-red-600 dark:text-red-400">
                      <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
              {suggestions.length > 0 && (
                <div className="space-y-0.5">
                  {suggestions.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-muted-foreground">
                      <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
