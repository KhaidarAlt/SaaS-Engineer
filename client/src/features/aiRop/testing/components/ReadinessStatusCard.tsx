import { CheckCircle2, XCircle } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ReadinessStatusCardProps {
  status: "READY" | "WARNING" | "BLOCKED";
  reasons: Array<{ label: string; passed: boolean; detail?: string; link?: string }>;
  isLoading?: boolean;
}

const STATUS_CONFIG = {
  READY: { label: "Готов", variant: "default" as const, className: "bg-green-600 text-white no-default-hover-elevate" },
  WARNING: { label: "Предупреждение", variant: "default" as const, className: "bg-yellow-500 text-white no-default-hover-elevate" },
  BLOCKED: { label: "Заблокировано", variant: "destructive" as const, className: "" },
};

export function ReadinessStatusCard({ status, reasons, isLoading }: ReadinessStatusCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Статус готовности</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const config = STATUS_CONFIG[status];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="text-lg">Статус готовности</CardTitle>
        <Badge variant={config.variant} className={config.className} data-testid="badge-readiness-status">
          {config.label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {reasons.map((reason, idx) => {
          const content = (
            <div
              className={`flex items-start gap-2 rounded-md p-2 ${reason.link ? "hover-elevate cursor-pointer" : ""}`}
              data-testid={`row-reason-${idx}`}
            >
              {reason.passed ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              )}
              <div className="flex flex-col gap-0.5">
                <span className="text-sm">{reason.label}</span>
                {reason.detail && (
                  <span className="text-xs text-muted-foreground">{reason.detail}</span>
                )}
              </div>
            </div>
          );

          if (reason.link) {
            return (
              <Link key={idx} href={reason.link}>
                {content}
              </Link>
            );
          }

          return <div key={idx}>{content}</div>;
        })}
      </CardContent>
    </Card>
  );
}
