import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, ChevronRight, ChevronLeft, Check, Loader2, 
  AlertCircle, Send, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CrmWizardProps {
  crmType: "bitrix24" | "amocrm";
  onClose: () => void;
  onSuccess: () => void;
}

interface Pipeline {
  id: string;
  name: string;
  stages?: Stage[];
}

interface Stage {
  id: string;
  name: string;
}

interface CrmUser {
  id: string;
  name: string;
}

const STEPS = [
  { id: 1, title: "Авторизация" },
  { id: 2, title: "Настройки" },
  { id: 3, title: "Тестирование" },
  { id: 4, title: "Готово" },
];

export function CrmWizard({ crmType, onClose, onSuccess }: CrmWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    pipelineId: "",
    pipelineName: "",
    stageId: "",
    stageName: "",
    responsibleUserId: "",
    responsibleUserName: "",
    entityType: "deal",
  });
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; dealId?: string } | null>(null);
  const [amoDomain, setAmoDomain] = useState("");

  const crmName = crmType === "bitrix24" ? "Bitrix24" : "amoCRM";

  const { data: authUrl } = useQuery<{ url: string }>({
    queryKey: ["/api/crm/auth/url", crmType],
    enabled: step === 1,
  });

  const { data: pipelines, isLoading: pipelinesLoading } = useQuery<Pipeline[]>({
    queryKey: ["/api/crm/integrations", integrationId, "pipelines"],
    enabled: !!integrationId && step === 2,
  });

  const { data: users, isLoading: usersLoading } = useQuery<CrmUser[]>({
    queryKey: ["/api/crm/integrations", integrationId, "users"],
    enabled: !!integrationId && step === 2,
  });

  const selectedPipeline = pipelines?.find(p => p.id === settings.pipelineId);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === "crm_oauth_callback") {
        const { code, domain, error } = event.data;
        
        if (error) {
          toast({ title: "Ошибка авторизации", description: error, variant: "destructive" });
          return;
        }

        try {
          const res = await apiRequest("POST", "/api/crm/auth/callback", {
            crmType,
            code,
            domain: domain || amoDomain,
          });
          const data = await res.json();
          
          if (data.integrationId) {
            setIntegrationId(data.integrationId);
            setStep(2);
            toast({ title: "Авторизация успешна!" });
          }
        } catch (e: any) {
          toast({ title: "Ошибка", description: e.message, variant: "destructive" });
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [crmType, amoDomain]);

  const openOAuthPopup = () => {
    if (!authUrl?.url) return;
    
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    window.open(
      authUrl.url,
      "crm_oauth",
      `width=${width},height=${height},left=${left},top=${top}`
    );
  };

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!integrationId) throw new Error("Нет ID интеграции");
      await apiRequest("PATCH", `/api/crm/integrations/${integrationId}`, settings);
    },
    onSuccess: () => {
      setStep(3);
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка сохранения", description: e.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      if (!integrationId) throw new Error("Нет ID интеграции");
      const res = await apiRequest("POST", `/api/crm/integrations/${integrationId}/test-deal`);
      return res.json();
    },
    onSuccess: (data) => {
      setTestResult(data);
      if (data.success) {
        setTimeout(() => setStep(4), 1500);
      }
    },
    onError: (e: Error) => {
      setTestResult({ success: false, message: e.message });
    },
  });

  const handlePipelineChange = (pipelineId: string) => {
    const pipeline = pipelines?.find(p => p.id === pipelineId);
    setSettings(s => ({
      ...s,
      pipelineId,
      pipelineName: pipeline?.name || "",
      stageId: "",
      stageName: "",
    }));
  };

  const handleStageChange = (stageId: string) => {
    const stage = selectedPipeline?.stages?.find(s => s.id === stageId);
    setSettings(s => ({
      ...s,
      stageId,
      stageName: stage?.name || "",
    }));
  };

  const handleUserChange = (userId: string) => {
    const user = users?.find(u => u.id === userId);
    setSettings(s => ({
      ...s,
      responsibleUserId: userId,
      responsibleUserName: user?.name || "",
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-background rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Подключение {crmName}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex justify-between px-6 py-4 border-b bg-muted/50">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step > s.id 
                  ? "bg-green-500 text-white" 
                  : step === s.id 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-muted-foreground"
              }`}>
                {step > s.id ? <Check className="h-4 w-4" /> : s.id}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 mx-1 ${step > s.id ? "bg-green-500" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-medium">Авторизация в {crmName}</h3>
                  <p className="text-sm text-muted-foreground">
                    Нажмите кнопку ниже, чтобы войти в вашу CRM систему и разрешить доступ
                  </p>
                </div>

                {crmType === "amocrm" && (
                  <div className="space-y-2">
                    <Label>Адрес вашего amoCRM</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="mycompany"
                        value={amoDomain}
                        onChange={(e) => setAmoDomain(e.target.value)}
                      />
                      <span className="text-muted-foreground">.amocrm.ru</span>
                    </div>
                  </div>
                )}

                <Button 
                  className="w-full gap-2" 
                  size="lg"
                  onClick={openOAuthPopup}
                  disabled={crmType === "amocrm" && !amoDomain}
                >
                  <ExternalLink className="h-4 w-4" />
                  Войти в {crmName}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Откроется окно авторизации {crmName}. После входа окно автоматически закроется.
                </p>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-medium">Настройки интеграции</h3>

                <div className="space-y-2">
                  <Label>Воронка продаж</Label>
                  <Select value={settings.pipelineId} onValueChange={handlePipelineChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={pipelinesLoading ? "Загрузка..." : "Выберите воронку"} />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelines?.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPipeline?.stages && (
                  <div className="space-y-2">
                    <Label>Этап для новой заявки</Label>
                    <Select value={settings.stageId} onValueChange={handleStageChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите этап" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedPipeline.stages.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Ответственный менеджер (необязательно)</Label>
                  <Select value={settings.responsibleUserId} onValueChange={handleUserChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={usersLoading ? "Загрузка..." : "Выберите менеджера"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Не выбран</SelectItem>
                      {users?.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {crmType === "bitrix24" && (
                  <div className="space-y-2">
                    <Label>Тип сущности</Label>
                    <Select value={settings.entityType} onValueChange={(v) => setSettings(s => ({ ...s, entityType: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deal">Сделка</SelectItem>
                        <SelectItem value="lead">Лид</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Назад
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={() => saveSettingsMutation.mutate()}
                    disabled={!settings.pipelineId || saveSettingsMutation.isPending}
                  >
                    {saveSettingsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Далее
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-medium">Тестовая заявка</h3>
                <p className="text-sm text-muted-foreground">
                  Отправим тестовую заявку в CRM, чтобы проверить что всё работает
                </p>

                {testResult && (
                  <div className={`p-4 rounded-lg ${testResult.success ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"}`}>
                    <div className="flex items-center gap-2">
                      {testResult.success ? (
                        <Check className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className={testResult.success ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}>
                        {testResult.message}
                      </span>
                    </div>
                    {testResult.dealId && (
                      <p className="text-sm text-muted-foreground mt-1">
                        ID сделки: {testResult.dealId}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Назад
                  </Button>
                  <Button 
                    className="flex-1 gap-2"
                    onClick={() => testMutation.mutate()}
                    disabled={testMutation.isPending}
                  >
                    {testMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Отправить тестовую заявку
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-4"
              >
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold">Интеграция активна!</h3>
                <p className="text-muted-foreground">
                  Теперь при каждом новом заказе в SmartCatalog будет автоматически создаваться сделка в {crmName}
                </p>
                <ul className="text-sm text-left space-y-2 bg-muted/50 p-4 rounded-lg">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    Автоматическое создание сделок
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    Передача контактных данных клиента
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    Список товаров в комментарии
                  </li>
                </ul>
                <Button className="w-full" onClick={onSuccess}>
                  Готово
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
