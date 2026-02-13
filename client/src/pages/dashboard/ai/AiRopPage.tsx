import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AiPaywall } from "@/components/AiPaywall";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Target, CheckCircle2, XCircle, AlertTriangle, TrendingUp, Users,
  MessageSquare, ArrowRight, Plus, Trash2, Edit2, Send, Loader2,
  ShieldCheck, BookOpen, GraduationCap, History, BarChart3,
  Zap, ArrowDown, Bot, UserCircle, Clock, Save
} from "lucide-react";

interface AiStatus {
  hasAccess: boolean;
  enabled?: boolean;
  planName?: string;
}

interface GoalReadiness {
  goal: string;
  status: "READY" | "WARNING" | "BLOCKED";
  message: string;
  checks: Array<{ label: string; passed: boolean; detail?: string }>;
}

interface KpiData {
  totalDialogs: number;
  goalReached: number;
  conversionRate: number;
  avgMessages: number;
  handovers: number;
  handoverRate: number;
}

interface FunnelData {
  steps: Array<{ label: string; count: number; rate: number }>;
}

interface HandoverRule {
  id: string;
  ruleType: string;
  thresholdValue: string | null;
  customRuleText: string | null;
  isActive: boolean;
  createdAt: string;
}

interface KnowledgeItem {
  id: string;
  type: string;
  title: string;
  content: string;
  isActive: boolean;
  createdAt: string;
}

interface TrainingItem {
  id: string;
  userMessage: string;
  aiOriginal: string;
  aiCorrected: string;
  stage: string | null;
  source: string | null;
  applied: boolean;
  createdAt: string;
}

interface TrainingResponse {
  items: TrainingItem[];
  total: number;
}

interface SettingsVersion {
  id: string;
  versionNumber: number;
  changedBy: string | null;
  changeReason: string | null;
  settingsSnapshot: Record<string, unknown> | null;
  createdAt: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const GOAL_TYPES = [
  { value: "CLOSE_DEAL", label: "Закрыть сделку", description: "AI доводит клиента до оплаты через Kaspi", icon: Target },
  { value: "QUALIFY_HANDOVER", label: "Квалификация + передача", description: "AI собирает инфо и передаёт менеджеру", icon: Users },
  { value: "CONSULT_MATCH", label: "Консультация + подбор", description: "AI подбирает товар по запросу клиента", icon: MessageSquare },
  { value: "ORDER_NO_PAYMENT", label: "Заказ без оплаты", description: "AI принимает заказ без онлайн-оплаты", icon: ShieldCheck },
];

const TRIGGER_TYPES = [
  { value: "keyword", label: "Ключевое слово" },
  { value: "sentiment", label: "Негативный тон" },
  { value: "repeat", label: "Повторный вопрос" },
  { value: "timeout", label: "Таймаут ответа" },
  { value: "explicit", label: "Запрос менеджера" },
];

export default function AiRopPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: status, isLoading: statusLoading } = useQuery<AiStatus>({
    queryKey: ["/api/ai/status"],
  });

  if (statusLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40" />)}
          </div>
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
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-ai-rop-title">AI-РОП</h1>
          <p className="text-muted-foreground">
            Центр управления AI-продажами: цели, аналитика, обучение
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid" data-testid="tabs-ai-rop">
            <TabsTrigger value="overview" data-testid="tab-overview">Обзор</TabsTrigger>
            <TabsTrigger value="rules" data-testid="tab-rules">Правила</TabsTrigger>
            <TabsTrigger value="knowledge" data-testid="tab-knowledge">База знаний</TabsTrigger>
            <TabsTrigger value="training" data-testid="tab-training">Обучение</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">История</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <OverviewTab />
          </TabsContent>
          <TabsContent value="rules" className="space-y-6 mt-6">
            <HandoverRulesTab />
          </TabsContent>
          <TabsContent value="knowledge" className="space-y-6 mt-6">
            <KnowledgeTab />
          </TabsContent>
          <TabsContent value="training" className="space-y-6 mt-6">
            <TrainingTab />
          </TabsContent>
          <TabsContent value="history" className="space-y-6 mt-6">
            <HistoryTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function OverviewTab() {
  const { toast } = useToast();

  const dateRange = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  const { data: settings } = useQuery<{ goal: string }>({
    queryKey: ["/api/ai-rop/settings"],
  });

  const { data: readiness, isLoading: readinessLoading } = useQuery<GoalReadiness>({
    queryKey: ["/api/ai-rop/goal-readiness"],
  });

  const { data: kpi, isLoading: kpiLoading } = useQuery<KpiData>({
    queryKey: ["/api/ai-rop/analytics/kpi", dateRange.from, dateRange.to],
  });

  const { data: funnel, isLoading: funnelLoading } = useQuery<FunnelData>({
    queryKey: ["/api/ai-rop/analytics/funnel", dateRange.from, dateRange.to],
  });

  const goalMutation = useMutation({
    mutationFn: async (goal: string) => {
      return apiRequest("PUT", "/api/ai-rop/settings", { goal });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-rop/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-rop/goal-readiness"] });
      toast({ title: "Цель обновлена" });
    },
  });

  const currentGoal = GOAL_TYPES.find((g) => g.value === settings?.goal) || GOAL_TYPES[0];

  return (
    <>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Target className="h-5 w-5" />
          Цель AI-ассистента
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {GOAL_TYPES.map((goal) => {
            const isActive = settings?.goal === goal.value;
            return (
              <Card
                key={goal.value}
                className={`cursor-pointer transition-all hover-elevate ${isActive ? "ring-2 ring-primary" : ""}`}
                onClick={() => goalMutation.mutate(goal.value)}
                data-testid={`card-goal-${goal.value}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <goal.icon className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{goal.label}</CardTitle>
                    </div>
                    {isActive && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{goal.description}</CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Card data-testid="card-readiness">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Готовность к работе
          </CardTitle>
          <CardDescription>
            {currentGoal.label}: проверка необходимых компонентов
          </CardDescription>
        </CardHeader>
        <CardContent>
          {readinessLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : readiness ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 mb-4">
                <Badge variant={readiness.status === "READY" ? "default" : "secondary"}>
                  {readiness.status === "READY" ? "Готов" : readiness.status === "WARNING" ? "Частично" : "Не готов"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {readiness.checks.filter((c) => c.passed).length} / {readiness.checks.length} проверок пройдено
                </span>
              </div>
              {readiness.message && (
                <p className="text-sm text-muted-foreground mb-2">{readiness.message}</p>
              )}
              {readiness.checks.map((check, i) => (
                <div key={i} className="flex items-start gap-3">
                  {check.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{check.label}</p>
                    <p className="text-xs text-muted-foreground">{check.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Нет данных</p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          KPI за 30 дней
        </h2>
        {kpiLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : kpi ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard label="Диалогов" value={kpi.totalDialogs} icon={MessageSquare} />
            <KpiCard label="Цель достигнута" value={kpi.goalReached} icon={Target} />
            <KpiCard label="Конверсия" value={`${kpi.conversionRate.toFixed(1)}%`} icon={TrendingUp} />
            <KpiCard label="Ср. сообщений" value={kpi.avgMessages.toFixed(1)} icon={MessageSquare} />
            <KpiCard label="Передач менеджеру" value={kpi.handovers} icon={Users} />
            <KpiCard label="% передач" value={`${kpi.handoverRate.toFixed(1)}%`} icon={ArrowRight} />
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Нет данных за выбранный период
            </CardContent>
          </Card>
        )}
      </div>

      {funnel && funnel.steps.length > 0 && (
        <Card data-testid="card-funnel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowDown className="h-5 w-5" />
              Воронка конверсии
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {funnel.steps.map((step, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{step.label}</span>
                    <span className="text-sm text-muted-foreground">
                      {step.count} ({step.rate.toFixed(0)}%)
                    </span>
                  </div>
                  <Progress value={step.rate} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <TestChatWidget />
    </>
  );
}

function KpiCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function TestChatWidget() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/ai-rop/test-chat", {
        message,
        history: messages,
      });
      return res.json();
    },
    onSuccess: (data: { reply: string }) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось получить ответ", variant: "destructive" });
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    sendMutation.mutate(text);
  };

  return (
    <Card data-testid="card-test-chat">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Тестовый чат
        </CardTitle>
        <CardDescription>Проверьте как AI отвечает с текущими настройками</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
          <ScrollArea className="h-64 p-3" ref={scrollRef}>
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Напишите сообщение, чтобы начать тест
              </p>
            )}
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && <Bot className="h-5 w-5 text-primary mt-1 shrink-0" />}
                  <div
                    className={`rounded-md px-3 py-2 max-w-[80%] text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === "user" && <UserCircle className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />}
                </div>
              ))}
              {sendMutation.isPending && (
                <div className="flex gap-2 items-center">
                  <Bot className="h-5 w-5 text-primary shrink-0" />
                  <div className="bg-muted rounded-md px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <Separator />
          <div className="flex gap-2 p-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Введите сообщение..."
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              disabled={sendMutation.isPending}
              data-testid="input-test-chat"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={sendMutation.isPending || !input.trim()}
              data-testid="button-send-test"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setMessages([])}
            data-testid="button-clear-chat"
          >
            Очистить чат
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function HandoverRulesTab() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<HandoverRule | null>(null);
  const [form, setForm] = useState({ ruleType: "keyword", customRuleText: "" });

  const { data: rules, isLoading } = useQuery<HandoverRule[]>({
    queryKey: ["/api/ai-rop/handover-rules"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      return apiRequest("POST", "/api/ai-rop/handover-rules", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-rop/handover-rules"] });
      setShowDialog(false);
      resetForm();
      toast({ title: "Правило создано" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof form }) => {
      return apiRequest("PUT", `/api/ai-rop/handover-rules/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-rop/handover-rules"] });
      setShowDialog(false);
      setEditingRule(null);
      resetForm();
      toast({ title: "Правило обновлено" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/ai-rop/handover-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-rop/handover-rules"] });
      toast({ title: "Правило удалено" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PUT", `/api/ai-rop/handover-rules/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-rop/handover-rules"] });
    },
  });

  function resetForm() {
    setForm({ ruleType: "keyword", customRuleText: "" });
  }

  function openEdit(rule: HandoverRule) {
    setEditingRule(rule);
    setForm({
      ruleType: rule.ruleType,
      customRuleText: rule.customRuleText || "",
    });
    setShowDialog(true);
  }

  function handleSubmit() {
    if (!form.customRuleText.trim()) {
      toast({ title: "Заполните описание правила", variant: "destructive" });
      return;
    }
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Правила передачи менеджеру
          </h2>
          <p className="text-sm text-muted-foreground">
            Когда AI должен передать диалог живому человеку
          </p>
        </div>
        <Button onClick={() => { resetForm(); setEditingRule(null); setShowDialog(true); }} data-testid="button-add-rule">
          <Plus className="h-4 w-4 mr-2" />
          Добавить правило
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : !rules || rules.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Нет правил передачи. Добавьте первое правило.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id} data-testid={`card-rule-${rule.id}`}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <Switch
                      checked={rule.isActive ?? true}
                      onCheckedChange={(isActive) => toggleMutation.mutate({ id: rule.id, isActive })}
                      data-testid={`switch-rule-${rule.id}`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">
                          {TRIGGER_TYPES.find((t) => t.value === rule.ruleType)?.label || rule.ruleType}
                        </Badge>
                      </div>
                      <p className="text-sm mt-1">{rule.customRuleText || rule.thresholdValue || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(rule)} data-testid={`button-edit-rule-${rule.id}`}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(rule.id)} data-testid={`button-delete-rule-${rule.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? "Редактировать правило" : "Новое правило"}</DialogTitle>
            <DialogDescription>Настройте условия передачи диалога менеджеру</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Тип правила</Label>
              <Select value={form.ruleType} onValueChange={(v) => setForm((f) => ({ ...f, ruleType: v }))}>
                <SelectTrigger data-testid="select-trigger-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Описание правила</Label>
              <Textarea
                value={form.customRuleText}
                onChange={(e) => setForm((f) => ({ ...f, customRuleText: e.target.value }))}
                placeholder="Например: при слове 'жалоба' передать менеджеру"
                rows={3}
                data-testid="input-rule-text"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Отмена</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-rule"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRule ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function KnowledgeTab() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
  const [form, setForm] = useState({ type: "product", title: "", content: "" });

  const { data: items, isLoading } = useQuery<KnowledgeItem[]>({
    queryKey: ["/api/ai-rop/knowledge-items"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => apiRequest("POST", "/api/ai-rop/knowledge-items", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-rop/knowledge-items"] });
      setShowDialog(false);
      resetForm();
      toast({ title: "Запись добавлена" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof form }) => apiRequest("PUT", `/api/ai-rop/knowledge-items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-rop/knowledge-items"] });
      setShowDialog(false);
      setEditingItem(null);
      resetForm();
      toast({ title: "Запись обновлена" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/ai-rop/knowledge-items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-rop/knowledge-items"] });
      toast({ title: "Запись удалена" });
    },
  });

  function resetForm() {
    setForm({ type: "product", title: "", content: "" });
  }

  function openEdit(item: KnowledgeItem) {
    setEditingItem(item);
    setForm({ type: item.type, title: item.title, content: item.content });
    setShowDialog(true);
  }

  function handleSubmit() {
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: "Заполните все поля", variant: "destructive" });
      return;
    }
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const CATEGORIES = [
    { value: "product", label: "Товары" },
    { value: "delivery", label: "Доставка" },
    { value: "payment", label: "Оплата" },
    { value: "return", label: "Возврат" },
    { value: "general", label: "Общее" },
  ];

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            База знаний
          </h2>
          <p className="text-sm text-muted-foreground">
            Вопросы и ответы, которые AI использует при общении
          </p>
        </div>
        <Button onClick={() => { resetForm(); setEditingItem(null); setShowDialog(true); }} data-testid="button-add-knowledge">
          <Plus className="h-4 w-4 mr-2" />
          Добавить
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : !items || items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            База знаний пуста. Добавьте первую запись.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} data-testid={`card-knowledge-${item.id}`}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="secondary">
                        {CATEGORIES.find((c) => c.value === item.type)?.label || item.type}
                      </Badge>
                      {!item.isActive && <Badge variant="outline">Выкл</Badge>}
                    </div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.content}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(item)} data-testid={`button-edit-knowledge-${item.id}`}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(item.id)} data-testid={`button-delete-knowledge-${item.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Редактировать запись" : "Новая запись"}</DialogTitle>
            <DialogDescription>Добавьте вопрос и ответ в базу знаний AI</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Категория</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger data-testid="select-knowledge-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Заголовок</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Как оформить заказ?"
                data-testid="input-knowledge-title"
              />
            </div>
            <div className="space-y-2">
              <Label>Содержание</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Для оформления заказа выберите товар и..."
                rows={4}
                data-testid="input-knowledge-content"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Отмена</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-knowledge"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingItem ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TrainingTab() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ userMessage: "", aiOriginal: "", aiCorrected: "", stage: "greeting" });

  const { data: trainingData, isLoading } = useQuery<TrainingResponse>({
    queryKey: ["/api/ai-rop/training-items"],
  });

  const items = trainingData?.items;

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => apiRequest("POST", "/api/ai-rop/training-items", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-rop/training-items"] });
      setShowDialog(false);
      setForm({ userMessage: "", aiOriginal: "", aiCorrected: "", stage: "greeting" });
      toast({ title: "Пример добавлен" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/ai-rop/training-items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-rop/training-items"] });
      toast({ title: "Пример удалён" });
    },
  });

  function handleSubmit() {
    if (!form.userMessage.trim() || !form.aiCorrected.trim()) {
      toast({ title: "Заполните сообщение и исправленный ответ", variant: "destructive" });
      return;
    }
    createMutation.mutate(form);
  }

  const STAGES = [
    { value: "greeting", label: "Приветствие" },
    { value: "qualification", label: "Квалификация" },
    { value: "presentation", label: "Презентация" },
    { value: "objection", label: "Работа с возражениями" },
    { value: "closing", label: "Закрытие" },
  ];

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Обучение AI
          </h2>
          <p className="text-sm text-muted-foreground">
            Примеры идеальных ответов для обучения ассистента
          </p>
        </div>
        <Button onClick={() => setShowDialog(true)} data-testid="button-add-training">
          <Plus className="h-4 w-4 mr-2" />
          Добавить пример
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : !items || items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Нет обучающих примеров. Добавьте первый пример.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} data-testid={`card-training-${item.id}`}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {item.stage && (
                        <Badge variant="secondary">
                          {STAGES.find((s) => s.value === item.stage)?.label || item.stage}
                        </Badge>
                      )}
                      {item.applied && <Badge variant="default">Применено</Badge>}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <UserCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-sm">{item.userMessage}</p>
                      </div>
                      {item.aiOriginal && (
                        <div className="flex items-start gap-2">
                          <Bot className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <p className="text-sm text-muted-foreground line-through">{item.aiOriginal}</p>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <Bot className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <p className="text-sm">{item.aiCorrected}</p>
                      </div>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(item.id)} className="shrink-0" data-testid={`button-delete-training-${item.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый обучающий пример</DialogTitle>
            <DialogDescription>Покажите AI как правильно отвечать на вопрос клиента</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Этап продажи</Label>
              <Select value={form.stage} onValueChange={(v) => setForm((f) => ({ ...f, stage: v }))}>
                <SelectTrigger data-testid="select-training-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Сообщение клиента</Label>
              <Textarea
                value={form.userMessage}
                onChange={(e) => setForm((f) => ({ ...f, userMessage: e.target.value }))}
                placeholder="Почему так дорого?"
                rows={2}
                data-testid="input-training-user"
              />
            </div>
            <div className="space-y-2">
              <Label>Оригинальный ответ AI (необязательно)</Label>
              <Textarea
                value={form.aiOriginal}
                onChange={(e) => setForm((f) => ({ ...f, aiOriginal: e.target.value }))}
                placeholder="Что AI ответил изначально..."
                rows={2}
                data-testid="input-training-original"
              />
            </div>
            <div className="space-y-2">
              <Label>Исправленный ответ</Label>
              <Textarea
                value={form.aiCorrected}
                onChange={(e) => setForm((f) => ({ ...f, aiCorrected: e.target.value }))}
                placeholder="Наша цена отражает высокое качество материалов и..."
                rows={4}
                data-testid="input-training-corrected"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Отмена</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              data-testid="button-save-training"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HistoryTab() {
  const { data: versions, isLoading } = useQuery<SettingsVersion[]>({
    queryKey: ["/api/ai-rop/settings-history"],
  });

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <History className="h-5 w-5" />
          История изменений
        </h2>
        <p className="text-sm text-muted-foreground">
          Все изменения настроек AI сохраняются автоматически
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : !versions || versions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            История изменений пуста
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {versions.map((v) => (
            <Card key={v.id} data-testid={`card-version-${v.id}`}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-sm font-medium shrink-0">
                      v{v.versionNumber}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{v.changeReason || "Изменение настроек"}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(v.createdAt).toLocaleString("ru-RU")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
