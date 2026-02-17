import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

interface WizardLayoutProps {
  title: string;
  subtitle?: string;
  backPath?: string;
  children: React.ReactNode;
}

export function WizardLayout({ title, subtitle, backPath, children }: WizardLayoutProps) {
  const [, navigate] = useLocation();

  return (
    <div data-testid="wizard-layout">
      {backPath && (
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => navigate(backPath)}
          data-testid="button-wizard-back"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Назад
        </Button>
      )}
      <div className="mb-6">
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
