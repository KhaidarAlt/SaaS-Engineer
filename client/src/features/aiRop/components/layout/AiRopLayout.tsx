import { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { AiRopTabs } from "./AiRopTabs";

interface Props {
  children: ReactNode;
}

export function AiRopLayout({ children }: Props) {
  return (
    <div className="min-h-screen bg-background" data-testid="ai-rop-layout">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center gap-2 py-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">AI-РОП</h1>
            <span className="text-xs text-muted-foreground hidden sm:inline">контролирую и улучшаю продажи</span>
          </div>
        </div>
        <AiRopTabs />
      </div>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {children}
      </div>
    </div>
  );
}
