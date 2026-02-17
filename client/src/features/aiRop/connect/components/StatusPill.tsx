import { Badge } from "@/components/ui/badge";
import type { ChannelStatus } from "../types/connectTypes";
import { STATUS_LABELS, STATUS_COLORS } from "../types/connectTypes";

interface StatusPillProps {
  status: ChannelStatus;
  className?: string;
}

export function StatusPill({ status, className = "" }: StatusPillProps) {
  return (
    <Badge
      variant="outline"
      className={`${STATUS_COLORS[status]} border-transparent text-xs ${className}`}
      data-testid={`status-pill-${status}`}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
