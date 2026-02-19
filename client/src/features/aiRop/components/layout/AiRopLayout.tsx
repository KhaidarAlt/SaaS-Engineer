import { ReactNode } from "react";
import { Sparkles, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { AiRopTabs } from "./AiRopTabs";

interface Props {
  children: ReactNode;
}

export function AiRopLayout({ children }: Props) {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background" data-testid="ai-rop-layout">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center gap-2 py-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              data-testid="button-back-dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
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
