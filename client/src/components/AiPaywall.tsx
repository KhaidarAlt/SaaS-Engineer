import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Sparkles, MessageSquare, BarChart3, Zap } from "lucide-react";
import { Link } from "wouter";

interface AiPaywallProps {
  currentPlan?: string;
}

export function AiPaywall({ currentPlan = "Каталог" }: AiPaywallProps) {
  const features = [
    { icon: Bot, title: "AI-ассистент", description: "Автоматические ответы клиентам 24/7" },
    { icon: MessageSquare, title: "Умные диалоги", description: "Продажи и консультации на автопилоте" },
    { icon: BarChart3, title: "Аналитика AI", description: "Отслеживание эффективности ассистента" },
    { icon: Zap, title: "Интеграции", description: "WhatsApp, Telegram и другие каналы" },
  ];

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]" data-testid="ai-paywall">
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">AI-ассистент</CardTitle>
          <CardDescription className="text-base">
            Подключите AI-ассистента для автоматизации продаж и поддержки клиентов
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <feature.icon className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">{feature.title}</p>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Ваш текущий план</p>
                <p className="font-semibold">{currentPlan}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Для доступа к AI</p>
                <p className="font-semibold text-primary">Каталог + AI</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold">Каталог + AI</p>
                <p className="text-sm text-muted-foreground">До 1000 AI-сообщений в месяц</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">19 990 ₸</p>
                <p className="text-sm text-muted-foreground">в месяц</p>
              </div>
            </div>
          </div>

          <Link href="/dashboard/billing">
            <Button className="w-full" size="lg" data-testid="button-upgrade-plan">
              Обновить тариф
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
