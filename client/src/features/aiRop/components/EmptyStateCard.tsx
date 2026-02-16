import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import type { LucideIcon } from "lucide-react";

interface Props {
  icon?: LucideIcon;
  title: string;
  description: string;
  bullets?: string[];
  ctaLabel?: string;
  ctaHref?: string;
}

export function EmptyStateCard({ icon: Icon, title, description, bullets, ctaLabel, ctaHref }: Props) {
  const [, navigate] = useLocation();

  return (
    <Card data-testid="empty-state-card">
      <CardContent className="py-12 flex flex-col items-center text-center space-y-4">
        {Icon && (
          <div className="rounded-full bg-muted p-4">
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className="space-y-2 max-w-md">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {bullets && bullets.length > 0 && (
          <ul className="text-sm text-muted-foreground text-left space-y-1 max-w-sm">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        )}
        {ctaLabel && ctaHref && (
          <Button
            variant="outline"
            onClick={() => navigate(ctaHref)}
            data-testid="button-empty-cta"
          >
            {ctaLabel}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
