import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AiPaywall } from "@/components/AiPaywall";
import { Link } from "wouter";
import { ArrowLeft, Settings, Save, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Tenant } from "@shared/schema";

interface AiStatus {
  hasAccess: boolean;
  enabled?: boolean;
  planName?: string;
}

const LANGUAGES = [
  { id: "ru", label: "Русский" },
  { id: "kz", label: "Қазақша" },
  { id: "en", label: "English" },
];

export default function AiSettingsPage() {
  const { toast } = useToast();
  const [systemPrompt, setSystemPrompt] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["ru"]);
  const [typingDelay, setTypingDelay] = useState(0);

  const { data: status, isLoading: statusLoading } = useQuery<AiStatus>({
    queryKey: ["/api/ai/status"],
  });

  const { data: tenant, isLoading: tenantLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenant"],
  });

  useEffect(() => {
    if (tenant) {
      setSystemPrompt(tenant.aiSystemPrompt || "");
      setSelectedLanguages(tenant.aiLanguages || ["ru"]);
      setTypingDelay(tenant.aiTypingDelay || 0);
    }
  }, [tenant]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", "/api/ai/settings", {
        aiSystemPrompt: systemPrompt,
        aiLanguages: selectedLanguages,
        aiTypingDelay: typingDelay,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Настройки сохранены" });
    },
    onError: () => {
      toast({ title: "Ошибка сохранения", variant: "destructive" });
    },
  });

  const toggleLanguage = (langId: string) => {
    setSelectedLanguages((prev) => {
      if (prev.includes(langId)) {
        if (prev.length === 1) return prev;
        return prev.filter((l) => l !== langId);
      }
      return [...prev, langId];
    });
  };

  const isLoading = statusLoading || tenantLoading;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  if (!status?.hasAccess) {
    return (
      <DashboardLayout>
        <AiPaywall currentPlan={status?.planName} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/ai">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-ai-settings-title">
              Настройки AI
            </h1>
            <p className="text-muted-foreground">
              Языки, системный промт и поведение ассистента
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Основные настройки
            </CardTitle>
            <CardDescription>
              Настройте поведение AI-ассистента
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-base font-medium">Языки ответов</Label>
              <p className="text-sm text-muted-foreground">
                AI будет отвечать на выбранных языках в зависимости от языка клиента
              </p>
              <div className="flex flex-wrap gap-4">
                {LANGUAGES.map((lang) => (
                  <div key={lang.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`lang-${lang.id}`}
                      checked={selectedLanguages.includes(lang.id)}
                      onCheckedChange={() => toggleLanguage(lang.id)}
                      data-testid={`checkbox-lang-${lang.id}`}
                    />
                    <Label 
                      htmlFor={`lang-${lang.id}`}
                      className="cursor-pointer"
                    >
                      {lang.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="systemPrompt" className="text-base font-medium">
                Системный промт
              </Label>
              <p className="text-sm text-muted-foreground">
                Инструкции для AI о том, как он должен общаться с клиентами
              </p>
              <Textarea
                id="systemPrompt"
                placeholder="Например: Ты вежливый и профессиональный продавец магазина электроники. Отвечай коротко и по делу. Предлагай товары из каталога..."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="min-h-[150px]"
                data-testid="textarea-system-prompt"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-base font-medium">
                Задержка печати: {typingDelay} сек
              </Label>
              <p className="text-sm text-muted-foreground">
                Имитация набора текста для естественности общения
              </p>
              <Slider
                value={[typingDelay]}
                onValueChange={([value]) => setTypingDelay(value)}
                min={0}
                max={10}
                step={1}
                className="w-full max-w-md"
                data-testid="slider-typing-delay"
              />
            </div>

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              data-testid="button-save-settings"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Сохранить настройки
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
