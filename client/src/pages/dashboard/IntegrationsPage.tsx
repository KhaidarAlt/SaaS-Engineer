import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  Link2, RefreshCw, Check, X, AlertTriangle, Clock, 
  ChevronRight, Loader2, Trash2, Settings, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageLoader } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { CrmIntegration } from "@shared/schema";
import { CrmWizard } from "@/components/CrmWizard";

import bitrix24Logo from "@assets/bitrix24-logo.svg";
import amocrmLogo from "@assets/amocrm-logo.svg";

const CRM_INFO = {
  bitrix24: {
    name: "Bitrix24",
    logo: bitrix24Logo,
    description: "Интеграция с Битрикс24 CRM для автоматического создания сделок",
  },
  amocrm: {
    name: "amoCRM",
    logo: amocrmLogo,
    description: "Интеграция с amoCRM для автоматического создания лидов",
  },
};

const STATUS_CONFIG = {
  connected: {
    label: "Подключено",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
    icon: Check,
  },
  disconnected: {
    label: "Не подключено",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
    icon: X,
  },
  error: {
    label: "Ошибка подключения",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
    icon: AlertTriangle,
  },
  pending: {
    label: "Настройка...",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
    icon: Clock,
  },
};

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedCrm, setSelectedCrm] = useState<"bitrix24" | "amocrm" | null>(null);

  const { data: integrations, isLoading } = useQuery<CrmIntegration[]>({
    queryKey: ["/api/crm/integrations"],
  });

  const { data: billing } = useQuery<{ subscription: { plan: { name: string; features?: string[] } } }>({
    queryKey: ["/api/billing"],
  });

  const currentPlanName = billing?.subscription?.plan?.name || "";
  const hasCrmAccess = ["Про", "Бизнес"].includes(currentPlanName);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/crm/integrations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/integrations"] });
      toast({ title: "Интеграция отключена" });
    },
    onError: () => {
      toast({ title: "Ошибка при отключении", variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/crm/integrations/${id}/test`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/integrations"] });
      if (data.success) {
        toast({ title: "Соединение активно" });
      } else {
        toast({ title: "Ошибка соединения", description: data.error, variant: "destructive" });
      }
    },
  });

  const handleConnect = (crmType: "bitrix24" | "amocrm") => {
    setSelectedCrm(crmType);
    setWizardOpen(true);
  };

  const getIntegration = (crmType: string) => {
    return integrations?.find(i => i.crmType === crmType);
  };

  if (isLoading) return <PageLoader />;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Интеграции</h1>
            <p className="text-muted-foreground">
              Подключите CRM для автоматического создания сделок из заказов
            </p>
          </div>
        </div>

        {!hasCrmAccess && (
          <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium">Функция недоступна на вашем тарифе</p>
                  <p className="text-sm text-muted-foreground">
                    CRM интеграции доступны на тарифах Про и Бизнес
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {(Object.keys(CRM_INFO) as Array<keyof typeof CRM_INFO>).map((crmType) => {
            const crm = CRM_INFO[crmType];
            const integration = getIntegration(crmType);
            const status = integration?.status || "disconnected";
            const statusConfig = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.disconnected;
            const StatusIcon = statusConfig.icon;

            return (
              <motion.div
                key={crmType}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className={!hasCrmAccess ? "opacity-60" : ""} data-testid={`card-crm-${crmType}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center p-2">
                          <img src={crm.logo} alt={crm.name} className="w-full h-full object-contain" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{crm.name}</CardTitle>
                          <Badge className={statusConfig.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{crm.description}</p>

                    {integration && integration.status === "connected" && (
                      <div className="space-y-2 text-sm">
                        {integration.crmDomain && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <ExternalLink className="w-4 h-4" />
                            <span>{integration.crmDomain}</span>
                          </div>
                        )}
                        {integration.pipelineName && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Settings className="w-4 h-4" />
                            <span>Воронка: {integration.pipelineName}</span>
                          </div>
                        )}
                        {integration.lastSyncAt && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span>Синхронизация: {new Date(integration.lastSyncAt).toLocaleString("ru")}</span>
                          </div>
                        )}
                        {integration.lastError && (
                          <div className="p-2 bg-red-50 dark:bg-red-950 rounded text-red-600 dark:text-red-400 text-xs">
                            {integration.lastError}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap">
                      {!integration || integration.status === "disconnected" ? (
                        <Button 
                          onClick={() => handleConnect(crmType)} 
                          disabled={!hasCrmAccess}
                          className="gap-2"
                          data-testid={`button-connect-${crmType}`}
                        >
                          <Link2 className="w-4 h-4" />
                          Подключить
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => testMutation.mutate(integration.id)}
                            disabled={testMutation.isPending}
                            data-testid={`button-test-${crmType}`}
                          >
                            {testMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                            <span className="ml-1">Проверить</span>
                          </Button>
                          
                          {integration.status === "error" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleConnect(crmType)}
                              data-testid={`button-reconnect-${crmType}`}
                            >
                              <RefreshCw className="w-4 h-4 mr-1" />
                              Переподключить
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm("Отключить интеграцию?")) {
                                deleteMutation.mutate(integration.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-disconnect-${crmType}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {wizardOpen && selectedCrm && (
          <CrmWizard
            crmType={selectedCrm}
            onClose={() => {
              setWizardOpen(false);
              setSelectedCrm(null);
            }}
            onSuccess={() => {
              setWizardOpen(false);
              setSelectedCrm(null);
              queryClient.invalidateQueries({ queryKey: ["/api/crm/integrations"] });
              toast({ title: "CRM успешно подключена!" });
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
