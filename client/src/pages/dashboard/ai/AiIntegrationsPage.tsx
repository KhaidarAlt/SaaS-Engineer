import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AiPaywall } from "@/components/AiPaywall";
import { Plug, MessageCircle, Send, Globe, Settings } from "lucide-react";
import { SiWhatsapp, SiTelegram } from "react-icons/si";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: any;
  status: "connected" | "available" | "coming_soon";
  color: string;
}

const integrations: Integration[] = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "Подключите AI-ассистента к WhatsApp для автоматических ответов клиентам",
    icon: SiWhatsapp,
    status: "available",
    color: "text-green-600",
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "Автоматизируйте общение через Telegram бота",
    icon: SiTelegram,
    status: "available",
    color: "text-blue-500",
  },
  {
    id: "instagram",
    name: "Instagram Direct",
    description: "Отвечайте на сообщения в Instagram автоматически",
    icon: MessageCircle,
    status: "coming_soon",
    color: "text-pink-600",
  },
  {
    id: "website",
    name: "Виджет на сайте",
    description: "Встройте чат-виджет на ваш сайт",
    icon: Globe,
    status: "coming_soon",
    color: "text-primary",
  },
];

export default function AiIntegrationsPage() {
  const { data: status } = useQuery<{ hasAccess: boolean; planName?: string }>({
    queryKey: ["/api/ai/status"],
  });

  if (!status?.hasAccess) {
    return <div className="p-6"><AiPaywall currentPlan={status?.planName} /></div>;
  }

  const getStatusBadge = (integration: Integration) => {
    switch (integration.status) {
      case "connected":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Подключено</Badge>;
      case "available":
        return <Badge variant="outline">Доступно</Badge>;
      case "coming_soon":
        return <Badge variant="secondary">Скоро</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Интеграции</h1>
        <p className="text-muted-foreground">Подключите AI-ассистента к каналам общения с клиентами</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((integration) => (
          <Card key={integration.id} data-testid={`card-integration-${integration.id}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <integration.icon className={`h-6 w-6 ${integration.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{integration.name}</CardTitle>
                  </div>
                </div>
                {getStatusBadge(integration)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CardDescription>{integration.description}</CardDescription>
              {integration.status === "connected" ? (
                <Button variant="outline" className="w-full" data-testid={`button-settings-${integration.id}`}>
                  <Settings className="mr-2 h-4 w-4" />
                  Настройки
                </Button>
              ) : integration.status === "available" ? (
                <Button className="w-full" data-testid={`button-connect-${integration.id}`}>
                  <Plug className="mr-2 h-4 w-4" />
                  Подключить
                </Button>
              ) : (
                <Button variant="secondary" className="w-full" disabled>
                  Скоро будет доступно
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Send className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">Нужен другой канал?</p>
          <p className="text-muted-foreground text-sm text-center mb-4">
            Мы постоянно добавляем новые интеграции. Напишите нам, какой канал вам нужен.
          </p>
          <Button variant="outline">Связаться с поддержкой</Button>
        </CardContent>
      </Card>
    </div>
  );
}
