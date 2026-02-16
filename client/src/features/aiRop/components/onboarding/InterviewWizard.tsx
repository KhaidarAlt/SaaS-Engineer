import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Target, Users, Search, ShoppingCart, Plus, Loader2,
  Award, Star, Sparkles, CreditCard, TrendingUp, Package,
  X, Check
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { fetchReadiness, fetchCatalogSegments, searchProducts } from "../../api/aiRopApi";
import { AI_ROP_KEYS } from "../../api/aiRopApi";
import type {
  GoalType,
  TonePreset,
  OnboardingData,
  AiRopSettings,
  ReadinessResult,
  CatalogSegments,
  ProductSearchResult,
  ManualTagData,
} from "../../types/aiRopTypes";
import {
  GOAL_LABELS,
  TONE_LABELS,
  DEFAULT_OBJECTIONS,
  HANDOVER_RULE_TYPES,
} from "../../types/aiRopTypes";

interface Props {
  onComplete: (data: OnboardingData) => void;
  initialSettings: AiRopSettings | null;
}

const GOAL_ICONS: Record<GoalType, typeof Target> = {
  CLOSE_DEAL: Target,
  QUALIFY_HANDOVER: Users,
  CONSULT_MATCH: Search,
  ORDER_NO_PAYMENT: ShoppingCart,
};

const TOTAL_STEPS = 10;

const USP_CHIPS = [
  "Быстрая доставка / самовывоз",
  "Официальная гарантия / сервис",
  "Лучшие цены / price-match",
  "Премиальная консультация / подбор",
  "Рассрочка / кредит",
  "Большой выбор / наличие",
];

const KZ_BANKS = [
  "Kaspi",
  "Halyk Bank",
  "ForteBank",
  "Jusan Bank",
  "Freedom Bank",
  "Home Credit Bank",
  "Bank CenterCredit (BCC)",
  "Altyn Bank",
  "Eurasian Bank",
  "Nurbank",
];

const SEGMENT_OPTIONS = [
  { key: "new", label: "Новинки", icon: Sparkles },
  { key: "premium", label: "Премиум", icon: Award },
  { key: "entry", label: "Бюджетные", icon: Package },
  { key: "slow", label: "Давно не покупали", icon: TrendingUp },
];

const slideVariants = {
  enter: { opacity: 0, x: 30 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
};

function WizardProgress({ step }: { step: number }) {
  const pct = ((step + 1) / TOTAL_STEPS) * 100;
  return (
    <div className="mb-6" data-testid="wizard-progress">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs text-muted-foreground">
          Шаг {step + 1} из {TOTAL_STEPS}
        </span>
        <span className="text-xs text-muted-foreground">{Math.round(pct)}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
          data-testid="progress-bar-fill"
        />
      </div>
    </div>
  );
}

function ReadinessBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    READY: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    WARNING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    BLOCKED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  const labelMap: Record<string, string> = {
    READY: "Готов",
    WARNING: "Внимание",
    BLOCKED: "Заблокирован",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${colorMap[status] || ""}`}
      data-testid={`badge-readiness-${status.toLowerCase()}`}
    >
      {labelMap[status] || status}
    </span>
  );
}

export function InterviewWizard({ onComplete, initialSettings }: Props) {
  const [step, setStep] = useState(0);
  const [selectedGoal, setSelectedGoal] = useState<GoalType>(
    initialSettings?.goal || "CLOSE_DEAL"
  );
  const [selectedTone, setSelectedTone] = useState<TonePreset>(
    (initialSettings?.tone as TonePreset) || "friendly"
  );
  const [customToneText, setCustomToneText] = useState("");
  const [selectedObjections, setSelectedObjections] = useState<string[]>([
    ...DEFAULT_OBJECTIONS,
  ]);
  const [customObjection, setCustomObjection] = useState("");
  const [selectedHandoverRules, setSelectedHandoverRules] = useState<string[]>([
    "explicit_request",
    "negative_sentiment",
  ]);
  const [thresholdValue, setThresholdValue] = useState("");

  const [isOfficialRep, setIsOfficialRep] = useState(false);
  const [representedBrands, setRepresentedBrands] = useState("");
  const [hasOwnBrand, setHasOwnBrand] = useState(false);
  const [ownBrands, setOwnBrands] = useState("");
  const [uspChips, setUspChips] = useState<string[]>([]);
  const [uspFreeText, setUspFreeText] = useState("");
  const [installmentEnabled, setInstallmentEnabled] = useState(false);
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [customBank, setCustomBank] = useState("");

  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [promoteCategories, setPromoteCategories] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [manualPick, setManualPick] = useState(false);
  const [manualTags, setManualTags] = useState<ManualTagData[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTagType, setSelectedTagType] = useState<"PRIORITY" | "FLAGSHIP">("PRIORITY");

  const {
    data: readiness,
    isLoading: readinessLoading,
  } = useQuery<ReadinessResult>({
    queryKey: ["/api/ai-rop/goal-readiness", selectedGoal],
    queryFn: () => fetchReadiness(selectedGoal),
    enabled: step === 1,
  });

  const {
    data: segments,
    isLoading: segmentsLoading,
  } = useQuery<CatalogSegments>({
    queryKey: AI_ROP_KEYS.catalogSegments,
    queryFn: fetchCatalogSegments,
    enabled: step === 6,
  });

  useEffect(() => {
    if (!productSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchProducts(productSearchQuery);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearchQuery]);

  function handleNext() {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      const handoverRules = selectedHandoverRules.map((ruleType) => ({
        ruleType,
        ...(ruleType === "amount_threshold" && thresholdValue
          ? { thresholdValue }
          : {}),
      }));
      onComplete({
        goal: selectedGoal,
        tone: selectedTone,
        objections: selectedObjections,
        handoverRules,
        ...(selectedTone === "custom" && customToneText
          ? { customToneText }
          : {}),
        businessProfile: {
          isOfficialRepresentative: isOfficialRep,
          representedBrands: isOfficialRep ? representedBrands.split(",").map(s => s.trim()).filter(Boolean) : [],
          hasOwnBrand,
          ownBrands: hasOwnBrand ? ownBrands.split(",").map(s => s.trim()).filter(Boolean) : [],
          uspPoints: uspChips,
          uspFreeText,
          installmentEnabled,
          installmentBanks: installmentEnabled ? selectedBanks : [],
        },
        promotionStrategy: {
          promoteNew: selectedSegments.includes("new"),
          promotePremium: selectedSegments.includes("premium"),
          promoteEntry: selectedSegments.includes("entry"),
          promoteSlow: selectedSegments.includes("slow"),
          promotedCategoryIds: promoteCategories ? selectedCategoryIds : [],
        },
        manualTags: manualPick ? manualTags : [],
      });
    }
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  function toggleObjection(obj: string) {
    setSelectedObjections((prev) =>
      prev.includes(obj) ? prev.filter((o) => o !== obj) : [...prev, obj]
    );
  }

  function addCustomObjection() {
    const trimmed = customObjection.trim();
    if (trimmed && !selectedObjections.includes(trimmed)) {
      setSelectedObjections((prev) => [...prev, trimmed]);
      setCustomObjection("");
    }
  }

  function toggleHandoverRule(value: string) {
    if (value === "never") {
      setSelectedHandoverRules(["never"]);
      return;
    }
    setSelectedHandoverRules((prev) => {
      const filtered = prev.filter((r) => r !== "never");
      if (filtered.includes(value)) {
        return filtered.filter((r) => r !== value);
      }
      return [...filtered, value];
    });
  }

  function toggleUspChip(chip: string) {
    setUspChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  }

  function toggleBank(bank: string) {
    setSelectedBanks((prev) =>
      prev.includes(bank) ? prev.filter((b) => b !== bank) : [...prev, bank]
    );
  }

  function addCustomBank() {
    const trimmed = customBank.trim();
    if (trimmed && !selectedBanks.includes(trimmed)) {
      setSelectedBanks((prev) => [...prev, trimmed]);
      setCustomBank("");
    }
  }

  function toggleSegment(key: string) {
    setSelectedSegments((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  }

  function addManualTag(product: ProductSearchResult) {
    if (manualTags.length >= 10) return;
    if (manualTags.some((t) => t.productId === product.id)) return;
    setManualTags((prev) => [
      ...prev,
      { productId: product.id, tagType: selectedTagType, weight: prev.length + 1 },
    ]);
    setProductSearchQuery("");
    setSearchResults([]);
  }

  function removeManualTag(productId: string) {
    setManualTags((prev) => prev.filter((t) => t.productId !== productId));
  }

  return (
    <div className="w-full max-w-2xl mx-auto" data-testid="interview-wizard">
      <WizardProgress step={step} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25 }}
        >
          {step === 0 && (
            <div data-testid="step-goal">
              <h3 className="text-xl font-semibold mb-2">Какая у вас цель?</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Выберите основной сценарий работы AI-РОПа
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(Object.keys(GOAL_LABELS) as GoalType[]).map((goalKey) => {
                  const goal = GOAL_LABELS[goalKey];
                  const Icon = GOAL_ICONS[goalKey];
                  const isSelected = selectedGoal === goalKey;
                  return (
                    <Card
                      key={goalKey}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "ring-2 ring-primary"
                          : "hover-elevate"
                      }`}
                      onClick={() => setSelectedGoal(goalKey)}
                      data-testid={`card-goal-${goalKey}`}
                    >
                      <CardContent className="pt-6 flex flex-col items-center text-center gap-2">
                        <Icon className="h-8 w-8 text-primary" />
                        <p className="font-medium">{goal.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {goal.description}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {step === 1 && (
            <div data-testid="step-readiness">
              <h3 className="text-xl font-semibold mb-2">Проверка готовности</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Проверяю, всё ли настроено для выбранной цели
              </p>
              {readinessLoading ? (
                <div className="flex items-center justify-center py-8 gap-2" data-testid="loading-readiness">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm text-muted-foreground">Проверяю…</span>
                </div>
              ) : readiness ? (
                <Card data-testid="card-readiness-result">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-base">Результат</CardTitle>
                    <ReadinessBadge status={readiness.status} />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{readiness.message}</p>
                    <div className="space-y-2">
                      {readiness.checks.map((check, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-sm"
                          data-testid={`readiness-check-${idx}`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              check.passed
                                ? "bg-green-500"
                                : "bg-red-500"
                            }`}
                          />
                          <span>{check.label}</span>
                          {check.detail && (
                            <span className="text-xs text-muted-foreground">
                              — {check.detail}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          )}

          {step === 2 && (
            <div data-testid="step-brand-rep">
              <h3 className="text-xl font-semibold mb-2">Вы официальный представитель бренда?</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Это позволит AI подчёркивать оригинальность и гарантию в общении с клиентами
              </p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Card
                  className={`cursor-pointer transition-colors ${isOfficialRep ? "ring-2 ring-primary" : "hover-elevate"}`}
                  onClick={() => setIsOfficialRep(true)}
                  data-testid="card-brand-yes"
                >
                  <CardContent className="pt-6 flex flex-col items-center text-center gap-2">
                    <Award className="h-8 w-8 text-primary" />
                    <p className="font-medium">Да</p>
                  </CardContent>
                </Card>
                <Card
                  className={`cursor-pointer transition-colors ${!isOfficialRep ? "ring-2 ring-primary" : "hover-elevate"}`}
                  onClick={() => setIsOfficialRep(false)}
                  data-testid="card-brand-no"
                >
                  <CardContent className="pt-6 flex flex-col items-center text-center gap-2">
                    <Package className="h-8 w-8 text-muted-foreground" />
                    <p className="font-medium">Нет</p>
                  </CardContent>
                </Card>
              </div>
              {isOfficialRep && (
                <div className="mt-4">
                  <label className="text-sm font-medium mb-2 block">
                    Укажите бренд(ы), которые вы представляете (через запятую)
                  </label>
                  <Input
                    placeholder="Apple, Samsung, Sony…"
                    value={representedBrands}
                    onChange={(e) => setRepresentedBrands(e.target.value)}
                    data-testid="input-represented-brands"
                  />
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div data-testid="step-own-brand">
              <h3 className="text-xl font-semibold mb-2">Есть ли товары под вашим собственным брендом?</h3>
              <p className="text-sm text-muted-foreground mb-6">
                AI будет подчёркивать контроль качества и лучшее соотношение цена/качество
              </p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Card
                  className={`cursor-pointer transition-colors ${hasOwnBrand ? "ring-2 ring-primary" : "hover-elevate"}`}
                  onClick={() => setHasOwnBrand(true)}
                  data-testid="card-own-brand-yes"
                >
                  <CardContent className="pt-6 flex flex-col items-center text-center gap-2">
                    <Star className="h-8 w-8 text-primary" />
                    <p className="font-medium">Да</p>
                  </CardContent>
                </Card>
                <Card
                  className={`cursor-pointer transition-colors ${!hasOwnBrand ? "ring-2 ring-primary" : "hover-elevate"}`}
                  onClick={() => setHasOwnBrand(false)}
                  data-testid="card-own-brand-no"
                >
                  <CardContent className="pt-6 flex flex-col items-center text-center gap-2">
                    <Package className="h-8 w-8 text-muted-foreground" />
                    <p className="font-medium">Нет</p>
                  </CardContent>
                </Card>
              </div>
              {hasOwnBrand && (
                <div className="mt-4">
                  <label className="text-sm font-medium mb-2 block">
                    Укажите название вашего бренда (или брендов через запятую)
                  </label>
                  <Input
                    placeholder="MyBrand, SecondBrand…"
                    value={ownBrands}
                    onChange={(e) => setOwnBrands(e.target.value)}
                    data-testid="input-own-brands"
                  />
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div data-testid="step-usp">
              <h3 className="text-xl font-semibold mb-2">Что делает ваш магазин уникальным?</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Чем вы лучше конкурентов? Выберите подходящие или добавьте свои
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {USP_CHIPS.map((chip) => {
                  const isSelected = uspChips.includes(chip);
                  return (
                    <Badge
                      key={chip}
                      variant={isSelected ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleUspChip(chip)}
                      data-testid={`chip-usp-${chip}`}
                    >
                      {isSelected && <Check className="h-3 w-3 mr-1" />}
                      {chip}
                    </Badge>
                  );
                })}
              </div>
              <div className="mt-4">
                <label className="text-sm font-medium mb-2 block">
                  Добавьте 1–3 фразы своими словами (если хотите)
                </label>
                <Textarea
                  placeholder="Например: У нас самый большой шоурум в городе, бесплатная примерка…"
                  value={uspFreeText}
                  onChange={(e) => setUspFreeText(e.target.value)}
                  rows={3}
                  data-testid="input-usp-free-text"
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div data-testid="step-installments">
              <h3 className="text-xl font-semibold mb-2">Есть ли рассрочка для клиентов?</h3>
              <p className="text-sm text-muted-foreground mb-6">
                AI сможет предлагать рассрочку когда клиент сомневается в цене
              </p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Card
                  className={`cursor-pointer transition-colors ${installmentEnabled ? "ring-2 ring-primary" : "hover-elevate"}`}
                  onClick={() => setInstallmentEnabled(true)}
                  data-testid="card-installment-yes"
                >
                  <CardContent className="pt-6 flex flex-col items-center text-center gap-2">
                    <CreditCard className="h-8 w-8 text-primary" />
                    <p className="font-medium">Да</p>
                  </CardContent>
                </Card>
                <Card
                  className={`cursor-pointer transition-colors ${!installmentEnabled ? "ring-2 ring-primary" : "hover-elevate"}`}
                  onClick={() => setInstallmentEnabled(false)}
                  data-testid="card-installment-no"
                >
                  <CardContent className="pt-6 flex flex-col items-center text-center gap-2">
                    <X className="h-8 w-8 text-muted-foreground" />
                    <p className="font-medium">Нет</p>
                  </CardContent>
                </Card>
              </div>
              {installmentEnabled && (
                <div className="mt-4">
                  <label className="text-sm font-medium mb-3 block">
                    Через какие банки доступна рассрочка?
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {KZ_BANKS.map((bank) => {
                      const isSelected = selectedBanks.includes(bank);
                      return (
                        <label
                          key={bank}
                          className="flex items-center gap-2 cursor-pointer text-sm"
                          data-testid={`label-bank-${bank}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleBank(bank)}
                            className="h-4 w-4 rounded border-muted-foreground"
                            data-testid={`checkbox-bank-${bank}`}
                          />
                          <span>{bank}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Другой банк…"
                      value={customBank}
                      onChange={(e) => setCustomBank(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomBank();
                        }
                      }}
                      data-testid="input-custom-bank"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={addCustomBank}
                      data-testid="button-add-bank"
                    >
                      <Plus />
                    </Button>
                  </div>
                  {selectedBanks.filter((b) => !KZ_BANKS.includes(b)).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedBanks.filter((b) => !KZ_BANKS.includes(b)).map((b) => (
                        <Badge
                          key={b}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => toggleBank(b)}
                          data-testid={`badge-custom-bank-${b}`}
                        >
                          {b} <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 6 && (
            <div data-testid="step-promotion">
              <h3 className="text-xl font-semibold mb-2">Стратегия продвижения</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Что AI-РОП будет предлагать клиентам в первую очередь?
              </p>

              {segmentsLoading ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm text-muted-foreground">Анализирую каталог…</span>
                </div>
              ) : segments ? (
                <>
                  <Card className="mb-4">
                    <CardContent className="pt-4">
                      <p className="text-sm mb-3">Я нашёл в каталоге:</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-blue-500" />
                          <span>Новинки: <strong>{segments.newCount}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Award className="h-4 w-4 text-amber-500" />
                          <span>Премиум: <strong>{segments.premiumCount}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-green-500" />
                          <span>Бюджетные: <strong>{segments.entryCount}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-red-500" />
                          <span>Залежавшиеся: <strong>{segments.slowCount}</strong></span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Средняя цена: {segments.avgPrice.toLocaleString()} ₸
                      </p>
                    </CardContent>
                  </Card>

                  <p className="text-sm font-medium mb-3">Что будем продвигать активнее?</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {SEGMENT_OPTIONS.map((seg) => {
                      const isSelected = selectedSegments.includes(seg.key);
                      return (
                        <Badge
                          key={seg.key}
                          variant={isSelected ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleSegment(seg.key)}
                          data-testid={`chip-segment-${seg.key}`}
                        >
                          {isSelected && <Check className="h-3 w-3 mr-1" />}
                          {seg.label}
                        </Badge>
                      );
                    })}
                    <Badge
                      variant={promoteCategories ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setPromoteCategories(!promoteCategories)}
                      data-testid="chip-segment-categories"
                    >
                      {promoteCategories && <Check className="h-3 w-3 mr-1" />}
                      Конкретные категории
                    </Badge>
                    <Badge
                      variant={manualPick ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setManualPick(!manualPick)}
                      data-testid="chip-segment-manual"
                    >
                      {manualPick && <Check className="h-3 w-3 mr-1" />}
                      Вручную до 10 товаров
                    </Badge>
                  </div>

                  {promoteCategories && segments.topCategories.length > 0 && (
                    <div className="mb-4">
                      <label className="text-sm font-medium mb-2 block">Выберите категории:</label>
                      <div className="space-y-1">
                        {segments.topCategories.map((cat) => (
                          <label
                            key={cat.id}
                            className="flex items-center gap-2 cursor-pointer text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={selectedCategoryIds.includes(cat.id)}
                              onChange={() => {
                                setSelectedCategoryIds((prev) =>
                                  prev.includes(cat.id) ? prev.filter((c) => c !== cat.id) : [...prev, cat.id]
                                );
                              }}
                              className="h-4 w-4 rounded border-muted-foreground"
                              data-testid={`checkbox-category-${cat.id}`}
                            />
                            <span>{cat.name} ({cat.count})</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {manualPick && (
                    <div className="mb-4">
                      <label className="text-sm font-medium mb-2 block">
                        Выберите до 10 товаров ({manualTags.length}/10)
                      </label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Рекомендую выбрать до 10 — так стратегия не размоется.
                      </p>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant={selectedTagType === "PRIORITY" ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => setSelectedTagType("PRIORITY")}
                          data-testid="badge-tag-priority"
                        >
                          Продавать чаще
                        </Badge>
                        <Badge
                          variant={selectedTagType === "FLAGSHIP" ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => setSelectedTagType("FLAGSHIP")}
                          data-testid="badge-tag-flagship"
                        >
                          Флагман
                        </Badge>
                      </div>
                      <div className="relative">
                        <Input
                          placeholder="Поиск по названию или артикулу…"
                          value={productSearchQuery}
                          onChange={(e) => setProductSearchQuery(e.target.value)}
                          data-testid="input-product-search"
                        />
                        {isSearching && (
                          <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        )}
                      </div>
                      {searchResults.length > 0 && (
                        <div className="border rounded-md mt-1 max-h-40 overflow-auto">
                          {searchResults.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer hover-elevate text-sm"
                              onClick={() => addManualTag(p)}
                              data-testid={`search-result-${p.id}`}
                            >
                              <div className="flex flex-col min-w-0">
                                <span className="truncate">{p.name}</span>
                                <span className="text-xs text-muted-foreground">{p.sku} — {Number(p.price).toLocaleString()} ₸</span>
                              </div>
                              <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                            </div>
                          ))}
                        </div>
                      )}
                      {manualTags.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {manualTags.map((tag) => (
                            <div
                              key={tag.productId}
                              className="flex items-center justify-between gap-2 text-sm bg-muted/50 rounded-md px-3 py-2"
                              data-testid={`manual-tag-${tag.productId}`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  {tag.tagType === "PRIORITY" ? "Чаще" : "Флагман"}
                                </Badge>
                                <span className="truncate">{tag.productId}</span>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeManualTag(tag.productId)}
                                data-testid={`button-remove-tag-${tag.productId}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Нет данных о каталоге</p>
              )}
            </div>
          )}

          {step === 7 && (
            <div data-testid="step-tone">
              <h3 className="text-xl font-semibold mb-2">Стиль общения</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Как AI-РОП будет общаться с клиентами?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(Object.keys(TONE_LABELS) as TonePreset[]).map((toneKey) => {
                  const tone = TONE_LABELS[toneKey];
                  const isSelected = selectedTone === toneKey;
                  return (
                    <Card
                      key={toneKey}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "ring-2 ring-primary"
                          : "hover-elevate"
                      }`}
                      onClick={() => setSelectedTone(toneKey)}
                      data-testid={`card-tone-${toneKey}`}
                    >
                      <CardContent className="pt-6">
                        <p className="font-medium mb-1">{tone.title}</p>
                        {tone.example && (
                          <p className="text-xs text-muted-foreground italic">
                            «{tone.example}»
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              {selectedTone === "custom" && (
                <div className="mt-4">
                  <Input
                    placeholder="Опишите свой стиль общения…"
                    value={customToneText}
                    onChange={(e) => setCustomToneText(e.target.value)}
                    data-testid="input-custom-tone"
                  />
                </div>
              )}
            </div>
          )}

          {step === 8 && (
            <div data-testid="step-objections">
              <h3 className="text-xl font-semibold mb-2">Возражения клиентов</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Выберите типичные возражения, на которые AI-РОП должен уметь отвечать
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {Array.from(new Set([...DEFAULT_OBJECTIONS, ...selectedObjections])).map(
                  (obj) => {
                    const isSelected = selectedObjections.includes(obj);
                    return (
                      <Badge
                        key={obj}
                        variant={isSelected ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleObjection(obj)}
                        data-testid={`chip-objection-${obj}`}
                      >
                        {obj}
                      </Badge>
                    );
                  }
                )}
              </div>
              <div className="flex items-center gap-2 mb-6">
                <Input
                  placeholder="Добавить своё…"
                  value={customObjection}
                  onChange={(e) => setCustomObjection(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomObjection();
                    }
                  }}
                  data-testid="input-custom-objection"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={addCustomObjection}
                  data-testid="button-add-objection"
                >
                  <Plus />
                </Button>
              </div>

              <h3 className="text-xl font-semibold mb-2">Передача менеджеру</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Когда AI-РОП должен передать диалог живому менеджеру?
              </p>
              <div className="space-y-3">
                {HANDOVER_RULE_TYPES.map((rule) => {
                  const isSelected = selectedHandoverRules.includes(rule.value);
                  return (
                    <div key={rule.value}>
                      <label
                        className="flex items-center gap-3 cursor-pointer"
                        data-testid={`label-handover-${rule.value}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleHandoverRule(rule.value)}
                          className="h-4 w-4 rounded border-muted-foreground"
                          data-testid={`checkbox-handover-${rule.value}`}
                        />
                        <span className="text-sm">{rule.label}</span>
                      </label>
                      {rule.value === "amount_threshold" && isSelected && (
                        <div className="ml-7 mt-2">
                          <Input
                            type="number"
                            placeholder="Сумма порога (₸)"
                            value={thresholdValue}
                            onChange={(e) => setThresholdValue(e.target.value)}
                            data-testid="input-threshold"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 9 && (
            <div data-testid="step-summary">
              <h3 className="text-xl font-semibold mb-2">Стратегия готова</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Проверьте настройки перед запуском
              </p>
              <Card data-testid="card-wizard-summary">
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Цель</p>
                    <p className="text-sm font-medium" data-testid="text-summary-goal">
                      {GOAL_LABELS[selectedGoal].title}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Стиль общения</p>
                    <p className="text-sm font-medium" data-testid="text-summary-tone">
                      {TONE_LABELS[selectedTone].title}
                      {selectedTone === "custom" && customToneText
                        ? ` — ${customToneText}`
                        : ""}
                    </p>
                  </div>

                  {(isOfficialRep || hasOwnBrand) && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Бренды</p>
                      <div className="flex flex-wrap gap-1" data-testid="summary-brands">
                        {isOfficialRep && (
                          <Badge variant="secondary" className="text-xs">
                            Офиц. представитель{representedBrands ? `: ${representedBrands}` : ""}
                          </Badge>
                        )}
                        {hasOwnBrand && (
                          <Badge variant="secondary" className="text-xs">
                            Свой бренд{ownBrands ? `: ${ownBrands}` : ""}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {uspChips.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">УТП</p>
                      <div className="flex flex-wrap gap-1" data-testid="summary-usp">
                        {uspChips.map((u) => (
                          <Badge key={u} variant="secondary" className="text-xs">{u}</Badge>
                        ))}
                      </div>
                      {uspFreeText && (
                        <p className="text-xs text-muted-foreground mt-1">{uspFreeText}</p>
                      )}
                    </div>
                  )}

                  {installmentEnabled && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Рассрочка</p>
                      <div className="flex flex-wrap gap-1" data-testid="summary-installments">
                        {selectedBanks.map((b) => (
                          <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {(selectedSegments.length > 0 || promoteCategories || manualPick) && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Продвижение</p>
                      <div className="flex flex-wrap gap-1" data-testid="summary-promotion">
                        {selectedSegments.map((s) => {
                          const seg = SEGMENT_OPTIONS.find((o) => o.key === s);
                          return (
                            <Badge key={s} variant="secondary" className="text-xs">
                              {seg?.label || s}
                            </Badge>
                          );
                        })}
                        {promoteCategories && selectedCategoryIds.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            Категории: {selectedCategoryIds.length}
                          </Badge>
                        )}
                        {manualPick && manualTags.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            Вручную: {manualTags.length} товаров
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Возражения</p>
                    <div className="flex flex-wrap gap-1" data-testid="summary-objections">
                      {selectedObjections.map((obj) => (
                        <Badge key={obj} variant="secondary" className="text-xs">
                          {obj}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Передача менеджеру</p>
                    <div className="flex flex-wrap gap-1" data-testid="summary-handover">
                      {selectedHandoverRules.map((ruleValue) => {
                        const rule = HANDOVER_RULE_TYPES.find(
                          (r) => r.value === ruleValue
                        );
                        return (
                          <Badge key={ruleValue} variant="secondary" className="text-xs">
                            {rule?.label || ruleValue}
                            {ruleValue === "amount_threshold" && thresholdValue
                              ? ` (${Number(thresholdValue).toLocaleString()} ₸)`
                              : ""}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex items-center justify-between gap-4">
        {step > 0 ? (
          <Button
            variant="outline"
            onClick={handleBack}
            data-testid="button-back"
          >
            Назад
          </Button>
        ) : (
          <div />
        )}
        <Button onClick={handleNext} data-testid="button-next">
          {step === TOTAL_STEPS - 1 ? "Запустить AI-РОПа" : "Далее"}
        </Button>
      </div>
    </div>
  );
}
