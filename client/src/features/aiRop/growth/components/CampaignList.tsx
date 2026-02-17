import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CAMPAIGN_TYPE_LABELS, CAMPAIGN_STATUS_LABELS, type GrowthCampaign } from "../types/growthTypes";
import { ArrowRight } from "lucide-react";

interface Props {
  campaigns: GrowthCampaign[];
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "RUNNING": return "default";
    case "COMPLETED": return "secondary";
    case "FAILED": return "destructive";
    default: return "outline";
  }
}

export function CampaignList({ campaigns }: Props) {
  const [, navigate] = useLocation();

  if (campaigns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center" data-testid="campaigns-empty">
        Нет кампаний
      </p>
    );
  }

  return (
    <div className="space-y-2" data-testid="campaign-list">
      {campaigns.map((c) => (
        <Card
          key={c.id}
          className="hover-elevate cursor-pointer"
          onClick={() => navigate(`/dashboard/ai/rop/growth/campaign/${c.id}`)}
          data-testid={`campaign-card-${c.id}`}
        >
          <CardContent className="p-4 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[120px]">
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">
                {CAMPAIGN_TYPE_LABELS[c.type as keyof typeof CAMPAIGN_TYPE_LABELS] || c.type}
              </p>
            </div>
            <Badge variant={statusVariant(c.status)}>
              {CAMPAIGN_STATUS_LABELS[c.status as keyof typeof CAMPAIGN_STATUS_LABELS] || c.status}
            </Badge>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{c.totalSent} отпр.</span>
              <span>{c.totalReplied} отв.</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
