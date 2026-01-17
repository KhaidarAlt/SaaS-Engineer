import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AiPaywall } from "@/components/AiPaywall";
import { Inbox, CheckCircle, Clock, AlertCircle, MessageSquare, User } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AiInboxTicket {
  id: string;
  conversationId?: string;
  type: string;
  priority: string;
  status: string;
  title: string;
  summary?: string;
  customerPhone?: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

const priorityColors: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
};

const typeLabels: Record<string, string> = {
  handoff: "Запрос человека",
  no_answer: "Нет ответа AI",
  complaint: "Жалоба",
  escalation: "Эскалация",
};

export default function AiInboxPage() {
  const { toast } = useToast();

  const { data: status } = useQuery<{ hasAccess: boolean; planName?: string }>({
    queryKey: ["/api/ai/status"],
  });

  const { data: allTickets, isLoading } = useQuery<AiInboxTicket[]>({
    queryKey: ["/api/ai/inbox"],
    enabled: status?.hasAccess,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PUT", `/api/ai/inbox/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/inbox"] });
      toast({ title: "Статус обновлён" });
    },
  });

  if (!status?.hasAccess) {
    return <div className="p-6"><AiPaywall currentPlan={status?.planName} /></div>;
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const openTickets = allTickets?.filter(t => t.status === "open") || [];
  const inProgressTickets = allTickets?.filter(t => t.status === "in_progress") || [];
  const closedTickets = allTickets?.filter(t => t.status === "closed") || [];

  const TicketList = ({ tickets }: { tickets: AiInboxTicket[] }) => (
    tickets.length === 0 ? (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Нет тикетов</p>
        </CardContent>
      </Card>
    ) : (
      <div className="space-y-3">
        {tickets.map((ticket) => (
          <Card key={ticket.id} data-testid={`card-ticket-${ticket.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={priorityColors[ticket.priority] || ""}>{ticket.priority}</Badge>
                    <Badge variant="outline">{typeLabels[ticket.type] || ticket.type}</Badge>
                  </div>
                  <p className="font-medium mb-1">{ticket.title}</p>
                  {ticket.summary && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{ticket.summary}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    {ticket.customerPhone && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {ticket.customerPhone}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(ticket.createdAt).toLocaleString("ru-RU")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {ticket.status === "open" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateMutation.mutate({ id: ticket.id, status: "in_progress" })}
                      data-testid={`button-start-${ticket.id}`}
                    >
                      Взять в работу
                    </Button>
                  )}
                  {ticket.status === "in_progress" && (
                    <Button
                      size="sm"
                      onClick={() => updateMutation.mutate({ id: ticket.id, status: "closed" })}
                      data-testid={`button-close-${ticket.id}`}
                    >
                      <CheckCircle className="mr-1 h-4 w-4" />
                      Закрыть
                    </Button>
                  )}
                  {ticket.conversationId && (
                    <Button size="sm" variant="ghost" data-testid={`button-view-${ticket.id}`}>
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Inbox</h1>
        <p className="text-muted-foreground">Уведомления и тикеты, требующие внимания</p>
      </div>

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Открытые
            {openTickets.length > 0 && (
              <Badge variant="destructive" className="ml-1">{openTickets.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            В работе
            {inProgressTickets.length > 0 && (
              <Badge variant="secondary" className="ml-1">{inProgressTickets.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="closed" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Закрытые
          </TabsTrigger>
        </TabsList>
        <TabsContent value="open" className="mt-4">
          <TicketList tickets={openTickets} />
        </TabsContent>
        <TabsContent value="in_progress" className="mt-4">
          <TicketList tickets={inProgressTickets} />
        </TabsContent>
        <TabsContent value="closed" className="mt-4">
          <TicketList tickets={closedTickets} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
