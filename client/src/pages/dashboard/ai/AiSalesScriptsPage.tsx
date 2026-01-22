import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AiPaywall } from "@/components/AiPaywall";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, CheckCircle2, FileText, ArrowLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";

interface AiSalesScript {
  id: string;
  tenantId: string;
  title: string;
  stagesJson: Array<{ stage: string; goal: string; questions: string[]; transitionCriteria: string[] }>;
  greetingTemplate: string;
  closingTemplate: string;
  objectionHandlingJson: Record<string, string>;
  forbiddenPhrasesJson: string[];
  version: number;
  isActive: boolean;
  createdAt: string;
}

export default function AiSalesScriptsPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [greeting, setGreeting] = useState("Здравствуйте! Чем могу помочь?");
  const [closing, setClosing] = useState("Спасибо за обращение! Хорошего дня!");

  const { data: status } = useQuery<{ hasAccess: boolean; planName?: string }>({
    queryKey: ["/api/ai/status"],
  });

  const { data: scripts, isLoading } = useQuery<AiSalesScript[]>({
    queryKey: ["/api/ai/sales-scripts"],
    enabled: status?.hasAccess,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; greetingTemplate: string; closingTemplate: string }) => {
      return apiRequest("POST", "/api/ai/sales-scripts", {
        ...data,
        stagesJson: [
          { stage: "Приветствие", goal: "Установить контакт", questions: ["Чем могу помочь?"], transitionCriteria: ["Клиент ответил"] },
          { stage: "Выявление потребностей", goal: "Понять запрос клиента", questions: ["Что вы ищете?"], transitionCriteria: ["Потребность определена"] },
          { stage: "Презентация", goal: "Предложить товар", questions: [], transitionCriteria: ["Клиент заинтересован"] },
          { stage: "Закрытие", goal: "Оформить заказ", questions: ["Готовы оформить заказ?"], transitionCriteria: ["Заказ оформлен"] },
        ],
        objectionHandlingJson: {},
        forbiddenPhrasesJson: [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/sales-scripts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/status"] });
      setOpen(false);
      setTitle("");
      toast({ title: "Скрипт создан" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/ai/sales-scripts/${id}/activate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/sales-scripts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/status"] });
      toast({ title: "Скрипт активирован" });
    },
  });

  if (!status?.hasAccess) {
    return <DashboardLayout><div className="p-6"><AiPaywall currentPlan={status?.planName} /></div></DashboardLayout>;
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/ai">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Скрипты продаж</h1>
            <p className="text-muted-foreground">Сценарии общения AI-ассистента с клиентами</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-script">
              <Plus className="mr-2 h-4 w-4" />
              Создать скрипт
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый скрипт продаж</DialogTitle>
              <DialogDescription>Создайте базовый скрипт, который можно настроить позже</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Название скрипта</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Основной скрипт продаж"
                  data-testid="input-script-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Приветствие</Label>
                <Textarea
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  placeholder="Здравствуйте! Чем могу помочь?"
                  data-testid="input-script-greeting"
                />
              </div>
              <div className="space-y-2">
                <Label>Прощание</Label>
                <Textarea
                  value={closing}
                  onChange={(e) => setClosing(e.target.value)}
                  placeholder="Спасибо за обращение!"
                  data-testid="input-script-closing"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
              <Button
                onClick={() => createMutation.mutate({ title, greetingTemplate: greeting, closingTemplate: closing })}
                disabled={!title || createMutation.isPending}
                data-testid="button-save-script"
              >
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {scripts?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Нет скриптов</p>
            <p className="text-muted-foreground text-sm">Создайте первый скрипт продаж для AI-ассистента</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {scripts?.map((script) => (
            <Card key={script.id} data-testid={`card-script-${script.id}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">{script.title}</CardTitle>
                    <Badge variant="outline">v{script.version}</Badge>
                    {script.isActive && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Активен
                      </Badge>
                    )}
                  </div>
                  {!script.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => activateMutation.mutate(script.id)}
                      disabled={activateMutation.isPending}
                      data-testid={`button-activate-${script.id}`}
                    >
                      Активировать
                    </Button>
                  )}
                </div>
                <CardDescription>
                  Создан: {new Date(script.createdAt).toLocaleDateString("ru-RU")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Приветствие</p>
                    <p className="text-sm">{script.greetingTemplate}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Этапов</p>
                    <p className="text-sm">{script.stagesJson?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}
