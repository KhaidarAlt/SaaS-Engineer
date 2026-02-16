import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Users, Search, ShoppingCart, Plus, Trash2, Save, ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { saveSettings, AI_ROP_KEYS } from "../../api/aiRopApi";
import { useToast } from "@/hooks/use-toast";
import type { AiRopSettings, GoalType, TonePreset, SalesBoosters, HandoverRule } from "../../types/aiRopTypes";
import { GOAL_LABELS, TONE_LABELS, HANDOVER_RULE_TYPES } from "../../types/aiRopTypes";

interface Props {
  settings: AiRopSettings | null;
  onSettingsSaved: () => void;
}

const GOAL_ICONS: Record<GoalType, typeof Target> = {
  CLOSE_DEAL: Target,
  QUALIFY_HANDOVER: Users,
  CONSULT_MATCH: Search,
  ORDER_NO_PAYMENT: ShoppingCart,
};

export function StrategyPanel({ settings, onSettingsSaved }: Props) {
  const { toast } = useToast();

  const [goal, setGoal] = useState<GoalType>("CLOSE_DEAL");
  const [tone, setTone] = useState<TonePreset>("friendly");
  const [customToneText, setCustomToneText] = useState("");
  const [boosters, setBoosters] = useState<SalesBoosters>({
    upsell: false,
    cheaperAlternative: false,
    scarcity: false,
    autoPromo: false,
  });
  const [objections, setObjections] = useState<string[]>([]);
  const [newObjection, setNewObjection] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [typingDelay, setTypingDelay] = useState(1500);
  const [languages, setLanguages] = useState<string[]>(["ru"]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newRuleType, setNewRuleType] = useState("");
  const [newRuleThreshold, setNewRuleThreshold] = useState("");

  useEffect(() => {
    if (!settings) return;
    setGoal(settings.goal);
    setTone(settings.tone as TonePreset);
    setBoosters(settings.salesBoostersJson ?? { upsell: false, cheaperAlternative: false, scarcity: false, autoPromo: false });
    setObjections(settings.objectionsJson ?? []);
    setSystemPrompt(settings.systemPromptCustom ?? "");
    setTemperature(parseFloat(settings.temperature) || 0.7);
    setTypingDelay(settings.typingDelay ?? 1500);
    const langStr = settings.language ?? "ru";
    setLanguages(langStr.includes(",") ? langStr.split(",") : [langStr]);
  }, [settings]);

  const { data: handoverRules = [], isLoading: rulesLoading } = useQuery<HandoverRule[]>({
    queryKey: AI_ROP_KEYS.handoverRules,
  });

  const createRuleMutation = useMutation({
    mutationFn: async (data: { ruleType: string; thresholdValue?: string }) => {
      await apiRequest("POST", "/api/ai-rop/handover-rules", {
        ruleType: data.ruleType,
        thresholdValue: data.thresholdValue || null,
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AI_ROP_KEYS.handoverRules });
      setNewRuleType("");
      setNewRuleThreshold("");
      toast({ title: "Правило добавлено" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось добавить правило", variant: "destructive" });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/ai-rop/handover-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AI_ROP_KEYS.handoverRules });
      toast({ title: "Правило удалено" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось удалить правило", variant: "destructive" });
    },
  });

  const handleAddRule = () => {
    if (!newRuleType) return;
    const ruleTypeDef = HANDOVER_RULE_TYPES.find((r) => r.value === newRuleType);
    if (ruleTypeDef?.hasThreshold && !newRuleThreshold) return;
    createRuleMutation.mutate({
      ruleType: newRuleType,
      thresholdValue: ruleTypeDef?.hasThreshold ? newRuleThreshold : undefined,
    });
  };

  const handleAddObjection = () => {
    const trimmed = newObjection.trim();
    if (!trimmed) return;
    setObjections((prev) => [...prev, trimmed]);
    setNewObjection("");
  };

  const handleRemoveObjection = (index: number) => {
    setObjections((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings({
        goal,
        tone,
        salesBoostersJson: boosters,
        objectionsJson: objections,
        systemPromptCustom: systemPrompt || null,
        temperature: temperature.toString(),
        typingDelay,
        language: languages.join(","),
      });
      toast({ title: "Настройки сохранены" });
      onSettingsSaved();
    } catch {
      toast({ title: "Ошибка", description: "Не удалось сохранить настройки", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const selectedRuleTypeDef = HANDOVER_RULE_TYPES.find((r) => r.value === newRuleType);

  return (
    <div data-testid="strategy-panel" className="space-y-4 p-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-base">Цель AI-продавца</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(Object.keys(GOAL_LABELS) as GoalType[]).map((key) => {
              const Icon = GOAL_ICONS[key];
              const info = GOAL_LABELS[key];
              const selected = goal === key;
              return (
                <button
                  key={key}
                  data-testid={`goal-card-${key}`}
                  onClick={() => setGoal(key)}
                  className={`flex flex-col items-center gap-2 rounded-md border p-3 text-center transition-colors ${
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-border hover-elevate"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{info.title}</span>
                  <span className="text-xs text-muted-foreground">{info.description}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-base">Правила передачи менеджеру</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rulesLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : handoverRules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Правил пока нет</p>
          ) : (
            <ul className="space-y-2">
              {handoverRules.map((rule) => {
                const label = HANDOVER_RULE_TYPES.find((r) => r.value === rule.ruleType)?.label ?? rule.ruleType;
                return (
                  <li
                    key={rule.id}
                    data-testid={`handover-rule-${rule.id}`}
                    className="flex items-center justify-between gap-2 rounded-md border p-2"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{label}</Badge>
                      {rule.thresholdValue && (
                        <span className="text-sm text-muted-foreground">{rule.thresholdValue} ₸</span>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      data-testid={`delete-rule-${rule.id}`}
                      onClick={() => deleteRuleMutation.mutate(rule.id)}
                      disabled={deleteRuleMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <Select value={newRuleType} onValueChange={setNewRuleType}>
                <SelectTrigger data-testid="select-rule-type">
                  <SelectValue placeholder="Тип правила" />
                </SelectTrigger>
                <SelectContent>
                  {HANDOVER_RULE_TYPES.map((rt) => (
                    <SelectItem key={rt.value} value={rt.value}>
                      {rt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedRuleTypeDef?.hasThreshold && (
              <Input
                data-testid="input-rule-threshold"
                type="number"
                placeholder="Сумма (₸)"
                value={newRuleThreshold}
                onChange={(e) => setNewRuleThreshold(e.target.value)}
                className="w-32"
              />
            )}
            <Button
              data-testid="button-add-rule"
              onClick={handleAddRule}
              disabled={!newRuleType || createRuleMutation.isPending}
            >
              <Plus className="mr-1 h-4 w-4" />
              Добавить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-base">Стиль общения</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(Object.keys(TONE_LABELS) as TonePreset[]).map((key) => {
              const info = TONE_LABELS[key];
              const selected = tone === key;
              return (
                <button
                  key={key}
                  data-testid={`tone-card-${key}`}
                  onClick={() => setTone(key)}
                  className={`flex flex-col gap-1 rounded-md border p-3 text-left transition-colors ${
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-border hover-elevate"
                  }`}
                >
                  <span className="text-sm font-medium">{info.title}</span>
                  {info.example && (
                    <span className="text-xs text-muted-foreground line-clamp-2">{info.example}</span>
                  )}
                </button>
              );
            })}
          </div>
          {tone === "custom" && (
            <Textarea
              data-testid="input-custom-tone"
              placeholder="Опишите стиль общения AI..."
              value={customToneText}
              onChange={(e) => setCustomToneText(e.target.value)}
              className="mt-2"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-base">Продажные бустеры</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {([
              { key: "upsell" as const, label: "Апселл" },
              { key: "cheaperAlternative" as const, label: "Предложить дешевле" },
              { key: "scarcity" as const, label: "Ограниченное предложение" },
              { key: "autoPromo" as const, label: "Авто промо-зона" },
            ]).map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-sm">{item.label}</span>
                <Switch
                  data-testid={`switch-${item.key}`}
                  checked={boosters[item.key]}
                  onCheckedChange={(checked) =>
                    setBoosters((prev) => ({ ...prev, [item.key]: checked }))
                  }
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-base">Возражения</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {objections.length === 0 ? (
            <p className="text-sm text-muted-foreground">Возражений пока нет</p>
          ) : (
            <ul className="space-y-2">
              {objections.map((obj, index) => (
                <li
                  key={index}
                  data-testid={`objection-${index}`}
                  className="flex items-center justify-between gap-2 rounded-md border p-2"
                >
                  <span className="text-sm">{obj}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    data-testid={`delete-objection-${index}`}
                    onClick={() => handleRemoveObjection(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2">
            <Input
              data-testid="input-new-objection"
              placeholder="Новое возражение..."
              value={newObjection}
              onChange={(e) => setNewObjection(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddObjection();
                }
              }}
            />
            <Button
              data-testid="button-add-objection"
              onClick={handleAddObjection}
              disabled={!newObjection.trim()}
            >
              <Plus className="mr-1 h-4 w-4" />
              Добавить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 cursor-pointer"
          onClick={() => setAdvancedOpen((prev) => !prev)}
          data-testid="toggle-advanced"
        >
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4" />
            Расширенные настройки
          </CardTitle>
          {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardHeader>
        {advancedOpen && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Системный промпт</label>
              <Textarea
                data-testid="input-system-prompt"
                placeholder="Системный промпт для AI..."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Температура: {temperature.toFixed(1)}
              </label>
              <Slider
                data-testid="slider-temperature"
                min={0}
                max={1}
                step={0.1}
                value={[temperature]}
                onValueChange={(val) => setTemperature(val[0])}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Точнее, строже</span>
                <span>Креативнее, свободнее</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Задержка печати (сек)</label>
              <Input
                data-testid="input-typing-delay"
                type="number"
                step="0.1"
                min="0"
                value={(typingDelay / 1000).toFixed(1)}
                onChange={(e) => setTypingDelay(Math.round(parseFloat(e.target.value || "0") * 1000))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Языки</label>
              <div className="space-y-2">
                {[
                  { value: "ru", label: "Русский" },
                  { value: "kz", label: "Казахский" },
                  { value: "en", label: "English" },
                ].map((lang) => {
                  const checked = languages.includes(lang.value);
                  return (
                    <label
                      key={lang.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        data-testid={`checkbox-lang-${lang.value}`}
                        checked={checked}
                        onChange={() => {
                          setLanguages((prev) => {
                            if (checked) {
                              const next = prev.filter((l) => l !== lang.value);
                              return next.length > 0 ? next : prev;
                            }
                            return [...prev, lang.value];
                          });
                        }}
                        className="rounded border-border"
                      />
                      <span className="text-sm">{lang.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <div className="flex justify-end">
        <Button
          data-testid="button-save-settings"
          onClick={handleSave}
          disabled={saving}
        >
          <Save className="mr-1 h-4 w-4" />
          {saving ? "Сохранение..." : "Сохранить настройки"}
        </Button>
      </div>
    </div>
  );
}
