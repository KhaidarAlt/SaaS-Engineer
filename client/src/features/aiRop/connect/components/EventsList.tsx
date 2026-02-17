import { useQuery } from "@tanstack/react-query";
import { fetchEvents, CONNECT_KEYS } from "../api/connectApi";
import { EVENT_TYPE_LABELS, CHANNEL_LABELS, type ChannelType } from "../types/connectTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock } from "lucide-react";

const EVENT_DOT_COLORS: Record<string, string> = {
  CONNECTED: "bg-green-500",
  DISCONNECTED: "bg-muted-foreground",
  ERROR: "bg-red-500",
  HEALTH_CHECK: "bg-blue-500",
  DISCLAIMER_ACCEPTED: "bg-yellow-500",
  TEST_SENT: "bg-purple-500",
};

export function EventsList() {
  const { data: events, isLoading } = useQuery({
    queryKey: CONNECT_KEYS.events,
    queryFn: () => fetchEvents(10),
    refetchInterval: 30000,
  });

  return (
    <Card data-testid="card-events-log">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Журнал событий
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : !events || events.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4" data-testid="events-empty">
            Нет событий
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="flex items-start gap-2 text-xs py-1.5 border-b last:border-0"
                data-testid={`event-${ev.id}`}
              >
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${EVENT_DOT_COLORS[ev.eventType] || "bg-muted"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium">
                      {EVENT_TYPE_LABELS[ev.eventType] || ev.eventType}
                    </span>
                    <span className="text-muted-foreground">
                      {CHANNEL_LABELS[ev.channelType as ChannelType] || ev.channelType}
                    </span>
                  </div>
                  {ev.message && (
                    <p className="text-muted-foreground truncate">{ev.message}</p>
                  )}
                </div>
                <span className="text-muted-foreground whitespace-nowrap shrink-0">
                  {new Date(ev.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
