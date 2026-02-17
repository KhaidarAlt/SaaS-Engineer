import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, AlertTriangle, XCircle, ExternalLink } from "lucide-react";
import { fetchReadiness, TESTING_KEYS } from "../testing/api/testingApi";

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; label: string; variant: "default" | "destructive" | "outline" }> = {
  READY: { icon: CheckCircle, label: "Готов", variant: "default" },
  WARNING: { icon: AlertTriangle, label: "Предупреждения", variant: "outline" },
  BLOCKED: { icon: XCircle, label: "Заблокирован", variant: "destructive" },
};

export function ReadinessCard() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery({
    queryKey: TESTING_KEYS.readiness(),
    queryFn: () => fetchReadiness(),
  });

  if (isLoading) {
    return (
      <Card className="p-6" data-testid="card-readiness">
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const config = STATUS_CONFIG[data.status] || STATUS_CONFIG.BLOCKED;
  const StatusIcon = config.icon;
  const blockers = data.reasons.filter((r) => !r.passed);

  return (
    <Card className="p-6 flex flex-col justify-between" data-testid="card-readiness">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h3 className="text-sm font-semibold">Готовность</h3>
          <Badge variant={config.variant} data-testid="badge-readiness-status">
            <StatusIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </div>
        <div className="space-y-2">
          {(blockers.length > 0 ? blockers : data.reasons).slice(0, 5).map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-2 flex-wrap" data-testid={`readiness-row-${i}`}>
              <div className="flex items-center gap-2">
                {r.passed ? (
                  <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                )}
                <span className="text-sm">{r.label}</span>
              </div>
              <span className="text-xs text-muted-foreground">{r.detail}</span>
            </div>
          ))}
        </div>
      </div>
      {blockers.length > 0 && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {blockers.slice(0, 2).map((b, i) =>
            b.link ? (
              <Button
                key={i}
                size="sm"
                variant="outline"
                onClick={() => navigate(b.link!)}
                data-testid={`button-fix-blocker-${i}`}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                {b.label}
              </Button>
            ) : null
          )}
        </div>
      )}
    </Card>
  );
}
