import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Package, Shirt, UtensilsCrossed, Brain, Save, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageLoader } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CATALOG_TEMPLATES, CatalogTemplateType, getTemplateById } from "@shared/templateRegistry";
import type { Tenant } from "@shared/schema";

const TEMPLATE_ICONS: Record<CatalogTemplateType, React.ElementType> = {
  universal: Package,
  fashion: Shirt,
  food: UtensilsCrossed,
};

export default function TemplatesPage() {
  const { toast } = useToast();
  const [confirmTemplate, setConfirmTemplate] = useState<CatalogTemplateType | null>(null);
  const [aiRoleName, setAiRoleName] = useState("");
  const [aiStyle, setAiStyle] = useState("professional");
  const [aiSystemPrompt, setAiSystemPrompt] = useState("");
  const [aiAllowedTopics, setAiAllowedTopics] = useState("");
  const [aiRestrictedTopics, setAiRestrictedTopics] = useState("");
  const [aiSalesScripts, setAiSalesScripts] = useState("");

  const { data: tenant, isLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenant"],
  });

  const currentTemplateId = (tenant?.catalogTemplate as CatalogTemplateType) || "universal";
  const currentTemplate = getTemplateById(currentTemplateId);

  useEffect(() => {
    if (tenant) {
      const tmpl = getTemplateById((tenant.catalogTemplate as CatalogTemplateType) || "universal");
      const savedPrompt = tenant.aiSystemPrompt || "";
      
      if (savedPrompt) {
        const roleMatch = savedPrompt.match(/^Роль: (.+)$/m);
        const styleMatch = savedPrompt.match(/^Стиль общения: (.+)$/m);
        const instrMatch = savedPrompt.match(/Инструкции:\n([\s\S]*?)(?=\n\n(?:Что можно|Что нельзя|Скрипты)|$)/);
        const allowedMatch = savedPrompt.match(/Что можно обсуждать:\n([\s\S]*?)(?=\n\n(?:Что нельзя|Скрипты)|$)/);
        const restrictedMatch = savedPrompt.match(/Что нельзя обсуждать:\n([\s\S]*?)(?=\n\nСкрипты|$)/);
        const scriptsMatch = savedPrompt.match(/Скрипты продаж:\n([\s\S]*)$/);
        
        setAiRoleName(roleMatch ? roleMatch[1] : tmpl.aiRole.roleName);
        if (styleMatch) {
          const styleMap: Record<string, string> = { "Формальный": "formal", "Дружелюбный": "friendly", "Профессиональный": "professional" };
          setAiStyle(styleMap[styleMatch[1]] || "professional");
        }
        setAiSystemPrompt(instrMatch ? instrMatch[1].trim() : savedPrompt);
        setAiAllowedTopics(allowedMatch ? allowedMatch[1].trim() : "");
        setAiRestrictedTopics(restrictedMatch ? restrictedMatch[1].trim() : "");
        setAiSalesScripts(scriptsMatch ? scriptsMatch[1].trim() : "");
      } else {
        setAiRoleName(tmpl.aiRole.roleName);
        setAiSystemPrompt(tmpl.aiRole.defaultPrompt);
      }
    }
  }, [tenant]);

  const switchTemplateMutation = useMutation({
    mutationFn: async (newTemplate: CatalogTemplateType) => {
      await apiRequest("PUT", "/api/tenant", { catalogTemplate: newTemplate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant"] });
      toast({ title: "Шаблон изменён", description: "Шаблон каталога успешно обновлён." });
      setConfirmTemplate(null);
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось сменить шаблон.", variant: "destructive" });
    },
  });

  const saveAiMutation = useMutation({
    mutationFn: async () => {
      const parts: string[] = [];
      if (aiRoleName) parts.push(`Роль: ${aiRoleName}`);
      if (aiStyle) {
        const styleLabels: Record<string, string> = { formal: "Формальный", friendly: "Дружелюбный", professional: "Профессиональный" };
        parts.push(`Стиль общения: ${styleLabels[aiStyle] || aiStyle}`);
      }
      if (aiSystemPrompt) parts.push(`Инструкции:\n${aiSystemPrompt}`);
      if (aiAllowedTopics.trim()) parts.push(`Что можно обсуждать:\n${aiAllowedTopics}`);
      if (aiRestrictedTopics.trim()) parts.push(`Что нельзя обсуждать:\n${aiRestrictedTopics}`);
      if (aiSalesScripts.trim()) parts.push(`Скрипты продаж:\n${aiSalesScripts}`);
      
      const composedPrompt = parts.join("\n\n");
      await apiRequest("PUT", "/api/tenant", {
        aiSystemPrompt: composedPrompt,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant"] });
      toast({ title: "Сохранено", description: "Настройки ИИ обновлены." });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось сохранить настройки ИИ.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <PageLoader />
      </DashboardLayout>
    );
  }

  const templateEntries = Object.values(CATALOG_TEMPLATES);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Шаблоны каталога</h1>
          <p className="text-muted-foreground mt-1" data-testid="text-page-description">
            Выберите шаблон, который лучше всего подходит для вашего бизнеса. Каждый шаблон включает уникальные поля товаров и AI-роль.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {templateEntries.map((tmpl) => {
            const isSelected = tmpl.id === currentTemplateId;
            const Icon = TEMPLATE_ICONS[tmpl.id];

            return (
              <Card
                key={tmpl.id}
                className={`hover-elevate transition-colors ${isSelected ? "border-primary" : ""}`}
                data-testid={`card-template-${tmpl.id}`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg">{tmpl.name}</CardTitle>
                    </div>
                    {isSelected && (
                      <Badge variant="default" data-testid={`badge-selected-${tmpl.id}`}>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Текущий шаблон
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{tmpl.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Возможности:</p>
                    <ul className="space-y-1">
                      {tmpl.features.map((feature, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">&#8226;</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">WAU-функции:</p>
                    <div className="flex flex-wrap gap-1">
                      {tmpl.wauFeatures.map((wf) => (
                        <Badge key={wf.id} variant="secondary" className="text-xs" data-testid={`badge-wau-${wf.id}`}>
                          {wf.label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {!isSelected && (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => setConfirmTemplate(tmpl.id)}
                      data-testid={`button-select-${tmpl.id}`}
                    >
                      Выбрать
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-bold" data-testid="text-ai-training-title">
              Обучение ИИ для этого каталога
            </h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Текущая роль: <span className="font-medium text-foreground">{currentTemplate.aiRole.roleName}</span>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ai-role-name">Кто ИИ</Label>
              <Input
                id="ai-role-name"
                value={aiRoleName}
                onChange={(e) => setAiRoleName(e.target.value)}
                placeholder="Например: AI Стилист"
                data-testid="input-ai-role-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-style">Стиль общения</Label>
              <Select value={aiStyle} onValueChange={setAiStyle}>
                <SelectTrigger id="ai-style" data-testid="select-ai-style">
                  <SelectValue placeholder="Выберите стиль" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">Формальный</SelectItem>
                  <SelectItem value="friendly">Дружелюбный</SelectItem>
                  <SelectItem value="professional">Профессиональный</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-system-prompt">Системный промпт</Label>
            <Textarea
              id="ai-system-prompt"
              value={aiSystemPrompt}
              onChange={(e) => setAiSystemPrompt(e.target.value)}
              rows={4}
              placeholder="Системный промпт для ИИ..."
              data-testid="textarea-ai-system-prompt"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ai-allowed-topics">Что можно</Label>
              <Textarea
                id="ai-allowed-topics"
                value={aiAllowedTopics}
                onChange={(e) => setAiAllowedTopics(e.target.value)}
                rows={3}
                placeholder="Темы, о которых ИИ может говорить..."
                data-testid="textarea-ai-allowed-topics"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-restricted-topics">Что нельзя</Label>
              <Textarea
                id="ai-restricted-topics"
                value={aiRestrictedTopics}
                onChange={(e) => setAiRestrictedTopics(e.target.value)}
                rows={3}
                placeholder="Темы, которые ИИ не должен обсуждать..."
                data-testid="textarea-ai-restricted-topics"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-sales-scripts">Скрипты продаж</Label>
            <Textarea
              id="ai-sales-scripts"
              value={aiSalesScripts}
              onChange={(e) => setAiSalesScripts(e.target.value)}
              rows={3}
              placeholder="Скрипты продаж для ИИ..."
              data-testid="textarea-ai-sales-scripts"
            />
          </div>

          <Button
            onClick={() => saveAiMutation.mutate()}
            disabled={saveAiMutation.isPending}
            data-testid="button-save-ai-settings"
          >
            {saveAiMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Сохранить настройки ИИ
          </Button>
        </div>
      </div>

      <AlertDialog open={!!confirmTemplate} onOpenChange={(open) => !open && setConfirmTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сменить шаблон каталога?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTemplate && (
                <>
                  Вы переключаетесь на шаблон <span className="font-medium">{getTemplateById(confirmTemplate).name}</span>.
                  Это изменит набор полей товаров и роль AI-ассистента.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-switch">Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmTemplate && switchTemplateMutation.mutate(confirmTemplate)}
              disabled={switchTemplateMutation.isPending}
              data-testid="button-confirm-switch"
            >
              {switchTemplateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Подтвердить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
