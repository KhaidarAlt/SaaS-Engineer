import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AiPaywall } from "@/components/AiPaywall";
import { BarChart3, MessageSquare, AlertTriangle, PhoneForwarded, XCircle } from "lucide-react";

interface AiAnalytics {
  totalConversations: number;
  handoffs: number;
  noAnswers: number;
  complaints: number;
  ordersFromAi: number;
  avgMessagesPerConversation: number;
  interventionsByType: Record<string, number>;
}

export default function AiAnalyticsPage() {
  const dateRange = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  const { data: status } = useQuery<{ hasAccess: boolean; planName?: string }>({
    queryKey: ["/api/ai/status"],
  });

  const { data: analytics, isLoading } = useQuery<AiAnalytics>({
    queryKey: ["/api/ai/analytics", dateRange],
    enabled: status?.hasAccess,
  });

  if (!status?.hasAccess) {
    return <div className="p-6"><AiPaywall currentPlan={status?.planName} /></div>;
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  const stats = [
    {
      title: "Всего диалогов",
      value: analytics?.totalConversations || 0,
      icon: MessageSquare,
      description: "За последние 30 дней",
    },
    {
      title: "Передано человеку",
      value: analytics?.handoffs || 0,
      icon: PhoneForwarded,
      description: "Запросы на живого оператора",
    },
    {
      title: "Без ответа AI",
      value: analytics?.noAnswers || 0,
      icon: XCircle,
      description: "AI не смог ответить",
    },
    {
      title: "Жалобы",
      value: analytics?.complaints || 0,
      icon: AlertTriangle,
      description: "Негативные обращения",
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Аналитика AI</h1>
        <p className="text-muted-foreground">Статистика работы AI-ассистента за последние 30 дней</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Среднее сообщений на диалог</CardTitle>
            <CardDescription>Глубина взаимодействия с клиентами</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">
              {(analytics?.avgMessagesPerConversation || 0).toFixed(1)}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              сообщений в среднем
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Заказы через AI</CardTitle>
            <CardDescription>Конверсия в продажи</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">
              {analytics?.ordersFromAi || 0}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              заказов оформлено с помощью AI
            </p>
          </CardContent>
        </Card>
      </div>

      {analytics?.interventionsByType && Object.keys(analytics.interventionsByType).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Типы вмешательств
            </CardTitle>
            <CardDescription>Распределение причин эскалации</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(analytics.interventionsByType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm">{type}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
