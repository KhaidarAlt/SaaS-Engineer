import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { GROWTH_KEYS, fetchScenarioTemplates } from "../api/growthApi";
import { GrowthSubNav } from "../components/GrowthSubNav";
import type { GrowthScenarioTemplate, NicheType } from "../types/growthTypes";
import { NICHE_LABELS, SCENARIO_TYPE_LABELS } from "../types/growthTypes";
import {
  FileText, Smartphone, Copy, ArrowRight, Sparkles,
  ShoppingCart, Shirt, UtensilsCrossed, LayoutGrid,
} from "lucide-react";

const NICHE_ICONS: Record<NicheType, typeof ShoppingCart> = {
  electronics: ShoppingCart,
  fashion: Shirt,
  food: UtensilsCrossed,
  general: LayoutGrid,
};

export function ScenariosPage() {
  const [, navigate] = useLocation();
  const [selectedNiche, setSelectedNiche] = useState<NicheType | "all">("all");

  const { data: templates, isLoading } = useQuery<GrowthScenarioTemplate[]>({
    queryKey: [...GROWTH_KEYS.scenarioTemplates, selectedNiche],
    queryFn: () => fetchScenarioTemplates(selectedNiche === "all" ? undefined : selectedNiche),
  });

  const grouped = (templates ?? []).reduce<Record<string, GrowthScenarioTemplate[]>>((acc, t) => {
    const key = t.scenarioType;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6" data-testid="scenarios-page">
      <GrowthSubNav />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold" data-testid="text-scenarios-title">Шаблоны сценариев</h2>
          <p className="text-xs text-muted-foreground">
            Готовые сообщения для разных ниш и типов рассылок
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={selectedNiche} onValueChange={(v) => setSelectedNiche(v as NicheType | "all")}>
          <SelectTrigger className="w-[200px]" data-testid="select-niche-filter">
            <Sparkles className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" data-testid="niche-option-all">Все ниши</SelectItem>
            {(Object.entries(NICHE_LABELS) as [NicheType, string][]).map(([key, label]) => {
              const Icon = NICHE_ICONS[key];
              return (
                <SelectItem key={key} value={key} data-testid={`niche-option-${key}`}>
                  <span className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <Badge variant="secondary" data-testid="badge-template-count">
          {templates?.length ?? 0} шаблонов
        </Badge>
      </div>

      {isLoading ? (
        <div className="space-y-3" data-testid="scenarios-loading">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (templates?.length ?? 0) === 0 ? (
        <Card data-testid="scenarios-empty">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">Нет шаблонов</h3>
            <p className="text-sm text-muted-foreground">
              Шаблоны появятся после инициализации системы
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6" data-testid="scenarios-grouped">
          {Object.entries(grouped).map(([scenarioType, items]) => (
            <div key={scenarioType} className="space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2" data-testid={`group-title-${scenarioType}`}>
                {SCENARIO_TYPE_LABELS[scenarioType] ?? scenarioType}
                <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((tpl) => (
                  <TemplateCard key={tpl.id} template={tpl} onUse={() => {
                    const routeMap: Record<string, string> = {
                      reactivation: "reactivation",
                      upsell: "upsell",
                      abandoned_dialog: "abandoned",
                      price_availability: "reminders",
                      nps: "nps",
                    };
                    navigate(`/dashboard/ai/rop/growth/${routeMap[tpl.scenarioType] ?? "reactivation"}`);
                  }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template, onUse }: { template: GrowthScenarioTemplate; onUse: () => void }) {
  const [showFull, setShowFull] = useState(false);
  const NicheIcon = NICHE_ICONS[template.niche as NicheType] ?? LayoutGrid;

  return (
    <Card className="hover-elevate" data-testid={`template-card-${template.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="rounded-md bg-primary/10 p-1.5 shrink-0">
              <NicheIcon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" data-testid={`text-template-name-${template.id}`}>
                {template.nameRu}
              </p>
              <Badge variant="secondary" className="text-[10px] mt-0.5">
                {NICHE_LABELS[template.niche as NicheType] ?? template.niche}
              </Badge>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground" data-testid={`text-template-desc-${template.id}`}>
          {template.descriptionRu}
        </p>

        <div
          className="bg-muted/50 rounded-md p-3 text-xs font-mono cursor-pointer"
          onClick={() => setShowFull(!showFull)}
          data-testid={`text-template-message-${template.id}`}
        >
          <div className="flex items-center gap-1 mb-1 text-muted-foreground">
            <Smartphone className="h-3 w-3" />
            <span className="text-[10px]">Превью сообщения</span>
          </div>
          <p className={showFull ? "" : "line-clamp-3"}>
            {template.messageTemplate}
          </p>
        </div>

        {template.placeholders.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {template.placeholders.map((p) => (
              <Badge key={p} variant="outline" className="text-[10px]">{`{${p}}`}</Badge>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              navigator.clipboard.writeText(template.messageTemplate);
            }}
            data-testid={`button-copy-template-${template.id}`}
          >
            <Copy className="h-3.5 w-3.5 mr-1" />
            Скопировать
          </Button>
          <Button
            size="sm"
            onClick={onUse}
            data-testid={`button-use-template-${template.id}`}
          >
            Использовать
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
