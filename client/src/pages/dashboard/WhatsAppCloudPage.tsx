import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  MessageCircle,
  Phone,
  FileText,
  Send,
  BarChart3,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  ExternalLink,
  RefreshCw,
  Plus,
  Settings,
  Zap,
  ChevronRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { 
  WaCloudIntegration, 
  WaCloudPhoneNumber, 
  WaCloudTemplate,
  WaCloudCampaign,
  WaCloudWarmupStatus 
} from "@shared/schema";

interface RiskStatus {
  score: "green" | "yellow" | "red";
  issues: string[];
  recommendations: string[];
}

const qualityColors = {
  green: { label: "Высокое", color: "text-green-600", bg: "bg-green-100" },
  yellow: { label: "Среднее", color: "text-yellow-600", bg: "bg-yellow-100" },
  red: { label: "Низкое", color: "text-red-600", bg: "bg-red-100" },
  unknown: { label: "Неизвестно", color: "text-muted-foreground", bg: "bg-muted" },
};

const tierLabels: Record<string, string> = {
  tier_1: "Низкий (250/день)",
  tier_2: "Средний (1K/день)",
  tier_3: "Стандарт (10K/день)",
  tier_4: "Высокий (100K/день)",
};

const templateStatusConfig = {
  draft: { label: "Черновик", color: "text-muted-foreground", bg: "bg-muted" },
  pending: { label: "На проверке", color: "text-yellow-600", bg: "bg-yellow-100" },
  approved: { label: "Одобрен", color: "text-green-600", bg: "bg-green-100" },
  rejected: { label: "Отклонён", color: "text-red-600", bg: "bg-red-100" },
};

export default function WhatsAppCloudPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("connection");
  const [testPhone, setTestPhone] = useState("");
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    category: "utility",
    language: "ru",
    bodyText: "",
    footerText: "",
  });

  const { data: integration, isLoading: integrationLoading } = useQuery<WaCloudIntegration | null>({
    queryKey: ["/api/whatsapp-cloud/integration"],
  });

  const { data: phoneNumbers, isLoading: phonesLoading } = useQuery<WaCloudPhoneNumber[]>({
    queryKey: ["/api/whatsapp-cloud/phones"],
    enabled: !!integration?.id,
  });

  const { data: templates, isLoading: templatesLoading } = useQuery<WaCloudTemplate[]>({
    queryKey: ["/api/whatsapp-cloud/templates"],
    enabled: !!integration?.id,
  });

  const { data: campaigns } = useQuery<WaCloudCampaign[]>({
    queryKey: ["/api/whatsapp-cloud/campaigns"],
    enabled: !!integration?.id,
  });

  const { data: warmupStatus } = useQuery<WaCloudWarmupStatus | null>({
    queryKey: ["/api/whatsapp-cloud/warmup"],
    enabled: !!integration?.id,
  });

  const { data: riskStatus } = useQuery<RiskStatus>({
    queryKey: ["/api/whatsapp-cloud/risk"],
    enabled: !!integration?.id,
  });

  const startOnboardingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/whatsapp-cloud/onboarding/start");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.oauthUrl) {
        window.open(data.oauthUrl, "_blank");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-cloud/integration"] });
    },
    onError: () => {
      toast({ title: "Ошибка запуска подключения", variant: "destructive" });
    },
  });

  const syncPhonesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/whatsapp-cloud/phones/sync");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-cloud/phones"] });
      toast({ title: "Номера синхронизированы" });
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: async ({ phoneNumberId, recipientPhone }: { phoneNumberId: string; recipientPhone: string }) => {
      const res = await apiRequest("POST", "/api/whatsapp-cloud/test-message", { phoneNumberId, recipientPhone });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Тестовое сообщение отправлено" });
      } else {
        toast({ title: data.error || "Ошибка отправки", variant: "destructive" });
      }
    },
  });

  const syncTemplatesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/whatsapp-cloud/templates/sync");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-cloud/templates"] });
      toast({ title: "Шаблоны синхронизированы" });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (template: typeof newTemplate) => {
      const res = await apiRequest("POST", "/api/whatsapp-cloud/templates", template);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-cloud/templates"] });
        toast({ title: "Шаблон создан и отправлен на проверку" });
        setShowTemplateDialog(false);
        setNewTemplate({ name: "", category: "utility", language: "ru", bodyText: "", footerText: "" });
      } else {
        toast({ title: data.error || "Ошибка создания", variant: "destructive" });
      }
    },
  });

  const onboardingSteps = [
    { step: 1, title: "Подготовка", description: "Проверка требований" },
    { step: 2, title: "Авторизация Meta", description: "Подключение аккаунта" },
    { step: 3, title: "Бизнес-аккаунт", description: "Выбор WABA" },
    { step: 4, title: "Номер телефона", description: "Подключение номера" },
    { step: 5, title: "Webhooks", description: "Настройка уведомлений" },
    { step: 6, title: "Биллинг Meta", description: "Настройка оплаты" },
  ];

  const currentStep = integration?.onboardingStep || 0;
  const isConnected = integration?.status === "connected" && integration?.onboardingCompleted;

  const renderConnectionTab = () => {
    if (!integration || integration.status === "disconnected") {
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-green-600" />
                Подключите WhatsApp Cloud API
              </CardTitle>
              <CardDescription>
                Официальный канал Meta для безопасной работы с WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 border rounded-lg">
                  <div className="font-medium mb-2">Надёжность</div>
                  <p className="text-sm text-muted-foreground">
                    Официальный API Meta без риска блокировки
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="font-medium mb-2">Масштабирование</div>
                  <p className="text-sm text-muted-foreground">
                    Несколько номеров и высокие лимиты
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="font-medium mb-2">Шаблоны</div>
                  <p className="text-sm text-muted-foreground">
                    Официальные рассылки по шаблонам
                  </p>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="font-medium">Что потребуется:</div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Аккаунт Meta (Facebook)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Свободный номер телефона
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Банковская карта для биллинга Meta
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground mt-2">
                  Это стандартные требования Meta. Мы проведём вас по всем шагам.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => startOnboardingMutation.mutate()}
                  disabled={startOnboardingMutation.isPending}
                  data-testid="button-start-connection"
                >
                  {startOnboardingMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Начать подключение
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (!integration.onboardingCompleted) {
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Подключение WhatsApp Cloud API</CardTitle>
              <CardDescription>
                Шаг {currentStep} из 6
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Progress value={(currentStep / 6) * 100} className="h-2" />

              <div className="grid gap-3">
                {onboardingSteps.map((step) => (
                  <div
                    key={step.step}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      step.step < currentStep
                        ? "bg-green-50 border-green-200"
                        : step.step === currentStep
                        ? "bg-blue-50 border-blue-200"
                        : "bg-muted/30"
                    }`}
                  >
                    {step.step < currentStep ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : step.step === currentStep ? (
                      <Clock className="h-5 w-5 text-blue-600" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                    )}
                    <div>
                      <div className="font-medium">{step.title}</div>
                      <div className="text-sm text-muted-foreground">{step.description}</div>
                    </div>
                  </div>
                ))}
              </div>

              {integration.connectionError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-600 font-medium">
                    <XCircle className="h-4 w-4" />
                    Ошибка подключения
                  </div>
                  <p className="text-sm text-red-600 mt-1">{integration.connectionError}</p>
                </div>
              )}

              {currentStep === 6 && integration.billingStatus !== "active" && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-600 font-medium mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    Оплата Meta не настроена
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Без настройки биллинга WhatsApp работать не будет.
                  </p>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      if (integration.businessId) {
                        window.open(`https://business.facebook.com/billing/${integration.businessId}`, "_blank");
                      }
                    }}
                    data-testid="button-add-billing"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Добавить карту для оплаты Meta
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Карта привязывается на стороне Meta. Мы не храним платёжные данные.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  WhatsApp Cloud API подключён
                </CardTitle>
                <CardDescription>
                  Официальный канал Meta активен
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-green-600 border-green-600">
                Активен
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">WABA ID</div>
                <div className="font-mono text-sm">{integration.wabaId || "—"}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Биллинг</div>
                <Badge variant={integration.billingStatus === "active" ? "default" : "destructive"}>
                  {integration.billingStatus === "active" ? "Активен" : "Требуется действие"}
                </Badge>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Webhooks</div>
                <Badge variant={integration.webhookActive ? "default" : "secondary"}>
                  {integration.webhookActive ? "Активны" : "Неактивны"}
                </Badge>
              </div>
            </div>

            {warmupStatus && warmupStatus.stage !== "full" && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-blue-600 font-medium mb-2">
                  <Zap className="h-4 w-4" />
                  Прогрев аккаунта: день {warmupStatus.currentDay} из 7
                </div>
                <Progress value={(warmupStatus.currentDay / 7) * 100} className="h-2 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {warmupStatus.recommendations?.[0] || "Продолжайте использовать аккаунт для разблокировки всех функций"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("phones")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <Phone className="h-8 w-8 text-blue-600 mb-2" />
                  <div className="font-medium">Номера</div>
                  <div className="text-2xl font-bold">{phoneNumbers?.length || 0}</div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("templates")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <FileText className="h-8 w-8 text-purple-600 mb-2" />
                  <div className="font-medium">Шаблоны</div>
                  <div className="text-2xl font-bold">{templates?.length || 0}</div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("security")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <Shield className="h-8 w-8 text-green-600 mb-2" />
                  <div className="font-medium">Безопасность</div>
                  <Badge
                    variant="outline"
                    className={
                      riskStatus?.score === "green"
                        ? "text-green-600 border-green-600"
                        : riskStatus?.score === "yellow"
                        ? "text-yellow-600 border-yellow-600"
                        : "text-red-600 border-red-600"
                    }
                  >
                    {riskStatus?.score === "green"
                      ? "Всё в порядке"
                      : riskStatus?.score === "yellow"
                      ? "Внимание"
                      : "Риск"}
                  </Badge>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderPhonesTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Номера телефонов</h2>
          <p className="text-sm text-muted-foreground">
            Управление подключёнными номерами WhatsApp
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => syncPhonesMutation.mutate()}
          disabled={syncPhonesMutation.isPending}
          data-testid="button-sync-phones"
        >
          {syncPhonesMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">Обновить</span>
        </Button>
      </div>

      {phonesLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !phoneNumbers?.length ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Номера не найдены</p>
            <p className="text-sm text-muted-foreground mt-1">
              Синхронизируйте номера из Meta Business Manager
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {phoneNumbers.map((phone) => {
            const quality = qualityColors[phone.qualityRating as keyof typeof qualityColors] || qualityColors.unknown;
            return (
              <Card key={phone.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="font-mono text-lg">{phone.displayPhoneNumber || phone.phoneNumber}</div>
                        {phone.isDefault && (
                          <Badge variant="secondary">По умолчанию</Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm">
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Статус:</span>
                              <Badge variant={phone.status === "active" ? "default" : "secondary"}>
                                {phone.status === "active" ? "Активен" : phone.status === "limited" ? "Ограничен" : "Проблема"}
                              </Badge>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Статус подключения номера</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Качество:</span>
                              <Badge variant="outline" className={`${quality.color} ${quality.bg}`}>
                                {quality.label}
                              </Badge>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            Качество номера влияет на лимиты и безопасность
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Лимит:</span>
                              <span>{tierLabels[phone.messagingTier] || phone.messagingTier}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            Уровень лимитов растёт автоматически при хорошем качестве
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Бизнес:</span>
                              <Badge variant={phone.businessStatus === "verified" ? "default" : "outline"}>
                                {phone.businessStatus === "verified" ? "Подтверждён" : "Не подтверждён"}
                              </Badge>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            Подтвердите бизнес для роста лимитов
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" data-testid={`button-test-${phone.id}`}>
                            Отправить тест
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Отправить тестовое сообщение</DialogTitle>
                            <DialogDescription>
                              Введите номер телефона для отправки тестового сообщения
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div>
                              <Label>Номер получателя</Label>
                              <Input
                                placeholder="+7 777 123 4567"
                                value={testPhone}
                                onChange={(e) => setTestPhone(e.target.value)}
                                data-testid="input-test-phone"
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              onClick={() => {
                                if (phone.phoneNumberId && testPhone) {
                                  sendTestMutation.mutate({
                                    phoneNumberId: phone.phoneNumberId,
                                    recipientPhone: testPhone,
                                  });
                                }
                              }}
                              disabled={sendTestMutation.isPending || !testPhone}
                              data-testid="button-send-test"
                            >
                              {sendTestMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Отправить
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Как улучшить качество номера:</p>
              <ul className="space-y-1">
                <li>- Отвечайте только заинтересованным клиентам</li>
                <li>- Не запускайте рассылки слишком рано</li>
                <li>- Подтвердите бизнес для роста лимитов</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderTemplatesTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Шаблоны сообщений</h2>
          <p className="text-sm text-muted-foreground">
            Создание и управление шаблонами для рассылок
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => syncTemplatesMutation.mutate()}
            disabled={syncTemplatesMutation.isPending}
            data-testid="button-sync-templates"
          >
            {syncTemplatesMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Синхронизировать</span>
          </Button>
          <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-template">
                <Plus className="h-4 w-4 mr-2" />
                Создать шаблон
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Новый шаблон</DialogTitle>
                <DialogDescription>
                  Создайте шаблон для отправки на проверку в Meta
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Название (латиницей, без пробелов)</Label>
                  <Input
                    placeholder="order_confirmation"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value.toLowerCase().replace(/\s/g, "_") })}
                    data-testid="input-template-name"
                  />
                </div>
                <div>
                  <Label>Категория</Label>
                  <Select
                    value={newTemplate.category}
                    onValueChange={(v) => setNewTemplate({ ...newTemplate, category: v })}
                  >
                    <SelectTrigger data-testid="select-template-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utility">
                        <Tooltip>
                          <TooltipTrigger className="text-left">Сервисное (Utility)</TooltipTrigger>
                          <TooltipContent>Сервисные уведомления</TooltipContent>
                        </Tooltip>
                      </SelectItem>
                      <SelectItem value="marketing">
                        <Tooltip>
                          <TooltipTrigger className="text-left">Маркетинг (Marketing)</TooltipTrigger>
                          <TooltipContent>Рекламные сообщения (доступны после прогрева)</TooltipContent>
                        </Tooltip>
                      </SelectItem>
                      <SelectItem value="authentication">Аутентификация</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Язык</Label>
                  <Select
                    value={newTemplate.language}
                    onValueChange={(v) => setNewTemplate({ ...newTemplate, language: v })}
                  >
                    <SelectTrigger data-testid="select-template-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ru">Русский</SelectItem>
                      <SelectItem value="kk">Казахский</SelectItem>
                      <SelectItem value="en">Английский</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Текст сообщения</Label>
                  <textarea
                    className="w-full min-h-[100px] p-3 border rounded-md text-sm"
                    placeholder="Здравствуйте! Ваш заказ {{1}} подтверждён."
                    value={newTemplate.bodyText}
                    onChange={(e) => setNewTemplate({ ...newTemplate, bodyText: e.target.value })}
                    data-testid="input-template-body"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Используйте {"{{1}}"}, {"{{2}}"} для переменных
                  </p>
                </div>
                <div>
                  <Label>Подпись (необязательно)</Label>
                  <Input
                    placeholder="SmartCatalog"
                    value={newTemplate.footerText}
                    onChange={(e) => setNewTemplate({ ...newTemplate, footerText: e.target.value })}
                    data-testid="input-template-footer"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
                  Отмена
                </Button>
                <Button
                  onClick={() => createTemplateMutation.mutate(newTemplate)}
                  disabled={createTemplateMutation.isPending || !newTemplate.name || !newTemplate.bodyText}
                  data-testid="button-submit-template"
                >
                  {createTemplateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Создать и отправить
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {templatesLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !templates?.length ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Шаблоны не найдены</p>
            <p className="text-sm text-muted-foreground mt-1">
              Создайте шаблон или синхронизируйте из Meta
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => {
            const status = templateStatusConfig[template.status as keyof typeof templateStatusConfig] || templateStatusConfig.draft;
            return (
              <Card key={template.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="font-medium">{template.name}</div>
                        <Badge variant="outline" className={`${status.color} ${status.bg}`}>
                          {status.label}
                        </Badge>
                        <Badge variant="secondary">
                          {template.category === "utility" ? "Сервисный" : template.category === "marketing" ? "Маркетинг" : "Аутентификация"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {template.bodyText?.substring(0, 100)}
                        {template.bodyText && template.bodyText.length > 100 ? "..." : ""}
                      </p>
                      {template.rejectionReason && (
                        <p className="text-sm text-red-600">
                          Причина отклонения: {template.rejectionReason}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {template.status === "approved" && (
                        <Button variant="outline" size="sm">
                          Использовать
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderBroadcastsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Официальные рассылки</h2>
          <p className="text-sm text-muted-foreground">
            Массовые рассылки по одобренным шаблонам
          </p>
        </div>
        <Button disabled={!warmupStatus?.broadcastEnabled} data-testid="button-create-campaign">
          <Plus className="h-4 w-4 mr-2" />
          Создать рассылку
        </Button>
      </div>

      {!warmupStatus?.broadcastEnabled && (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium">Рассылки временно недоступны</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Для новых аккаунтов рассылки открываются после прогрева (7 дней). 
                  Это снижает риск блокировки аккаунта.
                </p>
                {warmupStatus && (
                  <p className="text-sm text-blue-600 mt-2">
                    Прогрев: день {warmupStatus.currentDay} из 7
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!campaigns?.length ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Рассылок пока нет</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{campaign.name}</div>
                    <p className="text-sm text-muted-foreground">{campaign.description}</p>
                    <div className="flex gap-4 mt-2 text-sm">
                      <span>Отправлено: {campaign.sentCount}</span>
                      <span>Доставлено: {campaign.deliveredCount}</span>
                      <span>Ответов: {campaign.repliedCount}</span>
                    </div>
                  </div>
                  <Badge>
                    {campaign.status === "completed" ? "Завершена" : campaign.status === "sending" ? "Отправляется" : "Запланирована"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderAnalyticsTab = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Аналитика WhatsApp</h2>
        <p className="text-sm text-muted-foreground">
          Статистика сообщений и конверсий
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Отправлено</div>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Доставлено</div>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Ответы</div>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Заказы</div>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Воронка конверсии</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-24 text-sm text-muted-foreground">Сообщения</div>
              <div className="flex-1 bg-muted rounded-full h-4">
                <div className="bg-blue-600 h-4 rounded-full" style={{ width: "100%" }} />
              </div>
              <div className="w-16 text-right">100%</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-24 text-sm text-muted-foreground">Ответы</div>
              <div className="flex-1 bg-muted rounded-full h-4">
                <div className="bg-blue-600 h-4 rounded-full" style={{ width: "0%" }} />
              </div>
              <div className="w-16 text-right">0%</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-24 text-sm text-muted-foreground">Заказы</div>
              <div className="flex-1 bg-muted rounded-full h-4">
                <div className="bg-blue-600 h-4 rounded-full" style={{ width: "0%" }} />
              </div>
              <div className="w-16 text-right">0%</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-24 text-sm text-muted-foreground">Оплаты</div>
              <div className="flex-1 bg-muted rounded-full h-4">
                <div className="bg-green-600 h-4 rounded-full" style={{ width: "0%" }} />
              </div>
              <div className="w-16 text-right">0%</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Безопасность и статус</h2>
        <p className="text-sm text-muted-foreground">
          Мониторинг рисков и состояния аккаунта
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Общий статус
            </CardTitle>
            <Badge
              variant="outline"
              className={
                riskStatus?.score === "green"
                  ? "text-green-600 border-green-600"
                  : riskStatus?.score === "yellow"
                  ? "text-yellow-600 border-yellow-600"
                  : "text-red-600 border-red-600"
              }
            >
              {riskStatus?.score === "green"
                ? "Всё в порядке"
                : riskStatus?.score === "yellow"
                ? "Повышенный риск"
                : "Высокий риск"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {riskStatus?.issues?.length ? (
            <div className="space-y-2">
              <div className="font-medium">Обнаруженные проблемы:</div>
              {riskStatus.issues.map((issue, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  {issue}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Проблем не обнаружено
            </div>
          )}

          {riskStatus?.recommendations?.length ? (
            <div className="space-y-2">
              <div className="font-medium">Рекомендации:</div>
              {riskStatus.recommendations.map((rec, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ChevronRight className="h-4 w-4" />
                  {rec}
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {warmupStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Прогрев аккаунта
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>День {warmupStatus.currentDay} из 7</span>
              <Badge>{warmupStatus.stage === "full" ? "Завершён" : "В процессе"}</Badge>
            </div>
            <Progress value={(warmupStatus.currentDay / 7) * 100} />
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Лимит сегодня:</span>
                <span>{warmupStatus.dailyMessagesSent} / {warmupStatus.dailyMessageLimit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Маркетинг:</span>
                <span>{warmupStatus.marketingEnabled ? "Доступен" : "Недоступен"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Рассылки:</span>
                <span>{warmupStatus.broadcastEnabled ? "Доступны" : "Недоступны"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Активные каналы</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>WhatsApp Cloud API</span>
            </div>
            <Badge variant="outline" className="text-green-600">Активен</Badge>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>WAHA (резерв)</span>
            </div>
            <Badge variant="outline">Резерв</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            AI автоматически использует официальный канал, если он подключён.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  if (integrationLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <MessageCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">WhatsApp (Официальный канал Meta)</h1>
            <p className="text-muted-foreground">
              Безопасная работа с WhatsApp через официальный API
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
            <TabsTrigger value="connection" data-testid="tab-connection">
              <Settings className="h-4 w-4 mr-2 hidden sm:inline" />
              Подключение
            </TabsTrigger>
            <TabsTrigger value="phones" disabled={!isConnected} data-testid="tab-phones">
              <Phone className="h-4 w-4 mr-2 hidden sm:inline" />
              Номера
            </TabsTrigger>
            <TabsTrigger value="templates" disabled={!isConnected} data-testid="tab-templates">
              <FileText className="h-4 w-4 mr-2 hidden sm:inline" />
              Шаблоны
            </TabsTrigger>
            <TabsTrigger value="broadcasts" disabled={!isConnected} data-testid="tab-broadcasts">
              <Send className="h-4 w-4 mr-2 hidden sm:inline" />
              Рассылки
            </TabsTrigger>
            <TabsTrigger value="analytics" disabled={!isConnected} data-testid="tab-analytics">
              <BarChart3 className="h-4 w-4 mr-2 hidden sm:inline" />
              Аналитика
            </TabsTrigger>
            <TabsTrigger value="security" disabled={!isConnected} data-testid="tab-security">
              <Shield className="h-4 w-4 mr-2 hidden sm:inline" />
              Безопасность
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connection" className="mt-6">
            {renderConnectionTab()}
          </TabsContent>

          <TabsContent value="phones" className="mt-6">
            {renderPhonesTab()}
          </TabsContent>

          <TabsContent value="templates" className="mt-6">
            {renderTemplatesTab()}
          </TabsContent>

          <TabsContent value="broadcasts" className="mt-6">
            {renderBroadcastsTab()}
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            {renderAnalyticsTab()}
          </TabsContent>

          <TabsContent value="security" className="mt-6">
            {renderSecurityTab()}
          </TabsContent>
        </Tabs>
      </motion.div>
    </DashboardLayout>
  );
}
