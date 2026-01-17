import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { AiPaywall } from "@/components/AiPaywall";
import { Link } from "wouter";
import { 
  Bot, FileText, Tags, BookOpen, HelpCircle, Shield, 
  Inbox, MessageSquare, BarChart3, Plug, CheckCircle2, Circle,
  AlertCircle
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface AiStatus {
  hasAccess: boolean;
  enabled?: boolean;
  planName?: string;
  aiMessagesLimit?: number;
  upgradeRequired?: boolean;
  readiness?: {
    salesScriptConfigured: boolean;
    tagsConfigured: boolean;
    faqConfigured: boolean;
    knowledgeConfigured: boolean;
    policiesConfigured: boolean;
    overallProgress: number;
  };
}

const aiModules = [
  { key: "salesScriptConfigured", title: "Скрипт продаж", icon: FileText, path: "/dashboard/ai/scripts", description: "Настройте сценарий общения AI" },
  { key: "tagsConfigured", title: "Теги", icon: Tags, path: "/dashboard/ai/tags", description: "Автоматическая классификация диалогов" },
  { key: "knowledgeConfigured", title: "База знаний", icon: BookOpen, path: "/dashboard/ai/knowledge", description: "Информация о товарах и услугах" },
  { key: "faqConfigured", title: "FAQ", icon: HelpCircle, path: "/dashboard/ai/faq", description: "Часто задаваемые вопросы" },
  { key: "policiesConfigured", title: "Политики", icon: Shield, path: "/dashboard/ai/policies", description: "Правила работы ассистента" },
];

const aiPages = [
  { title: "Inbox", icon: Inbox, path: "/dashboard/ai/inbox", description: "Уведомления и тикеты" },
  { title: "Песочница", icon: MessageSquare, path: "/dashboard/ai/sandbox", description: "Тестирование диалогов" },
  { title: "Аналитика AI", icon: BarChart3, path: "/dashboard/ai/analytics", description: "Статистика ассистента" },
  { title: "Интеграции", icon: Plug, path: "/dashboard/ai/integrations", description: "Подключение каналов" },
];

export default function AiOverviewPage() {
  const { toast } = useToast();
  
  const { data: status, isLoading } = useQuery<AiStatus>({
    queryKey: ["/api/ai/status"],
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest("PUT", "/api/ai/settings", { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/status"] });
      toast({
        title: status?.enabled ? "AI-ассистент выключен" : "AI-ассистент включён",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!status?.hasAccess) {
    return (
      <div className="p-6">
        <AiPaywall currentPlan={status?.planName} />
      </div>
    );
  }

  const readiness = status.readiness;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-ai-title">AI-ассистент</h1>
          <p className="text-muted-foreground">
            Управление автоматическим ассистентом продаж
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant={status.enabled ? "default" : "secondary"}>
            {status.enabled ? "Активен" : "Выключен"}
          </Badge>
          <Switch
            checked={status.enabled}
            onCheckedChange={(checked) => toggleMutation.mutate(checked)}
            disabled={toggleMutation.isPending}
            data-testid="switch-ai-toggle"
          />
        </div>
      </div>

      {readiness && readiness.overallProgress < 100 && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-lg">Настройте AI-ассистента</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Заполните все разделы для полноценной работы ассистента
            </p>
            <div className="flex items-center gap-3">
              <Progress value={readiness.overallProgress} className="flex-1" />
              <span className="text-sm font-medium">{readiness.overallProgress}%</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Настройка ассистента</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {aiModules.map((module) => {
            const isConfigured = readiness?.[module.key as keyof typeof readiness] as boolean;
            return (
              <Link key={module.key} href={module.path}>
                <Card className="h-full hover-elevate cursor-pointer transition-all" data-testid={`card-ai-${module.key}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <module.icon className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">{module.title}</CardTitle>
                      </div>
                      {isConfigured ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{module.description}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Инструменты</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {aiPages.map((page) => (
            <Link key={page.title} href={page.path}>
              <Card className="h-full hover-elevate cursor-pointer transition-all" data-testid={`card-ai-${page.title.toLowerCase()}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <page.icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{page.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{page.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Использование AI
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Сообщений в этом месяце</p>
              <p className="text-2xl font-bold">0 / {status.aiMessagesLimit?.toLocaleString()}</p>
            </div>
            <Progress value={0} className="w-32" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
