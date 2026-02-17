import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { WizardLayout } from "../components/WizardLayout";
import { DisclaimerGate } from "../components/DisclaimerGate";
import { fetchDisclaimerStatus, toggleChannelAi, CONNECT_KEYS } from "../api/connectApi";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, QrCode, CheckCircle, Wifi, WifiOff } from "lucide-react";

type WizardStep = "disclaimer" | "qr" | "configure" | "test";

export function WhatsAppWahaWizardPage() {
  const { toast } = useToast();
  const [step, setStep] = useState<WizardStep>("disclaimer");
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string>("");
  const [sessionStatus, setSessionStatus] = useState<string>("waiting");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [polling, setPolling] = useState(false);

  const { data: disclaimerStatus, isLoading: disclaimerLoading } = useQuery({
    queryKey: CONNECT_KEYS.disclaimerStatus,
    queryFn: fetchDisclaimerStatus,
  });

  useEffect(() => {
    if (disclaimerStatus?.accepted && step === "disclaimer") {
      setStep("qr");
    }
    if (!disclaimerLoading && !disclaimerStatus?.accepted && step !== "disclaimer") {
      setStep("disclaimer");
    }
  }, [disclaimerStatus, disclaimerLoading, step]);

  const createInstanceMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/waha/instances", {});
      return res.json();
    },
    onSuccess: (data) => {
      setInstanceId(data.id);
      fetchQR(data.id);
    },
    onError: (err: any) => {
      toast({ title: "Ошибка создания сессии", description: err.message, variant: "destructive" });
    },
  });

  const fetchQR = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/waha/instances/${id}/qr`, { credentials: "include" });
      const data = await res.json();
      if (data.qrCode) {
        setQrCode(data.qrCode);
        setPolling(true);
      }
    } catch {
      toast({ title: "Ошибка получения QR", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    if (!polling || !instanceId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/waha/instances/${instanceId}/status`, { credentials: "include" });
        const data = await res.json();
        setSessionStatus(data.wahaStatus || data.status);
        if (data.wahaStatus === "WORKING" || data.status === "running") {
          setPolling(false);
          setStep("configure");
          queryClient.invalidateQueries({ queryKey: CONNECT_KEYS.channels });
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [polling, instanceId]);

  const saveMut = useMutation({
    mutationFn: () => toggleChannelAi("WHATSAPP_WAHA", aiEnabled),
    onSuccess: () => {
      setStep("test");
      queryClient.invalidateQueries({ queryKey: CONNECT_KEYS.channels });
    },
  });

  const testMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/waha/instances/${instanceId}/status`, { credentials: "include" });
      return res.json();
    },
    onSuccess: (data) => {
      const ok = data.wahaStatus === "WORKING" || data.status === "running";
      toast({
        title: ok ? "Подключение активно" : "Нет подключения",
        description: ok ? "WAHA сессия работает" : `Статус: ${data.wahaStatus || data.status}`,
        variant: ok ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: CONNECT_KEYS.events });
    },
  });

  if (step === "disclaimer") {
    return (
      <WizardLayout
        title="Подключение WAHA"
        subtitle="Быстрое подключение WhatsApp через QR-код"
        backPath="/dashboard/ai/rop/connections/whatsapp"
      >
        <DisclaimerGate onAccepted={() => setStep("qr")} />
      </WizardLayout>
    );
  }

  return (
    <WizardLayout
      title="Подключение WAHA"
      subtitle="Быстрое подключение WhatsApp через QR-код"
      backPath="/dashboard/ai/rop/connections/whatsapp"
    >
      <div className="max-w-lg space-y-4" data-testid="waha-wizard">
        <div className="flex items-center gap-2 mb-4">
          {["qr", "configure", "test"].map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : ["qr", "configure", "test"].indexOf(step) > i
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              {i < 2 && <div className="w-8 h-px bg-border" />}
            </div>
          ))}
        </div>

        {step === "qr" && (
          <Card data-testid="step-qr">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                QR подключение
              </h3>

              {!instanceId ? (
                <Button
                  onClick={() => createInstanceMut.mutate()}
                  disabled={createInstanceMut.isPending}
                  data-testid="button-get-qr"
                >
                  {createInstanceMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Получить QR
                </Button>
              ) : qrCode ? (
                <div className="space-y-3">
                  <div className="bg-white p-4 rounded-md inline-block" data-testid="qr-display">
                    <img
                      src={qrCode.startsWith("data:") ? qrCode : `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`}
                      alt="QR Code"
                      className="w-48 h-48"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {polling ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                        <span className="text-sm text-muted-foreground">Ожидаем сканирование...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-600 dark:text-green-400">Сессия активна</span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Загрузка QR...</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === "configure" && (
          <Card data-testid="step-configure">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-green-500" />
                <h3 className="text-sm font-medium">Настройка AI</h3>
              </div>

              <div className="flex items-center justify-between gap-4 py-2">
                <Label htmlFor="ai-toggle" className="text-sm">
                  AI отвечает клиентам в WhatsApp (WAHA)
                </Label>
                <Switch
                  id="ai-toggle"
                  checked={aiEnabled}
                  onCheckedChange={setAiEnabled}
                  data-testid="switch-ai-waha"
                />
              </div>

              <Button
                className="w-full"
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending}
                data-testid="button-save-config"
              >
                {saveMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Сохранить
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "test" && (
          <Card data-testid="step-test">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <h3 className="text-sm font-medium">Готово!</h3>
              </div>

              <p className="text-sm text-muted-foreground">
                WAHA подключён. Проверьте работоспособность, нажав кнопку тестирования.
              </p>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => testMut.mutate()}
                disabled={testMut.isPending}
                data-testid="button-test-waha"
              >
                {testMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Отправить тест
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </WizardLayout>
  );
}
