import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Save, Loader2, Tag, Settings, Eye, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageLoader } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Tenant } from "@shared/schema";

const catalogSettingsSchema = z.object({
  catalogUsp: z.string().max(120, "Максимум 120 символов").optional(),
  showProductSpecs: z.boolean().optional(),
  showProductStock: z.boolean().optional(),
  showWhatsAppButton: z.boolean().optional(),
  showQuickView: z.boolean().optional(),
  showFavorites: z.boolean().optional(),
  showCrossSell: z.boolean().optional(),
  showFilters: z.boolean().optional(),
  showFloatingWhatsApp: z.boolean().optional(),
  showAiConsultant: z.boolean().optional(),
  showPaymentMethods: z.boolean().optional(),
});

type CatalogSettingsData = z.infer<typeof catalogSettingsSchema>;

const PRODUCT_TAGS = [
  { id: "hit", label: "Хит", color: "bg-red-500" },
  { id: "new", label: "Новинка", color: "bg-green-500" },
  { id: "best_price", label: "Лучшая цена", color: "bg-blue-500" },
  { id: "sale", label: "Распродажа", color: "bg-orange-500" },
  { id: "delivery_today", label: "Доставка сегодня", color: "bg-purple-500" },
  { id: "in_stock", label: "В наличии", color: "bg-emerald-500" },
  { id: "low_stock", label: "Мало", color: "bg-yellow-500" },
];

export default function CatalogSettingsPage() {
  const { toast } = useToast();
  const [enabledTags, setEnabledTags] = useState<string[]>(PRODUCT_TAGS.map(t => t.id));

  const { data: tenant, isLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenant"],
  });

  const form = useForm<CatalogSettingsData>({
    resolver: zodResolver(catalogSettingsSchema),
    defaultValues: {
      catalogUsp: "",
      showProductSpecs: true,
      showProductStock: true,
      showWhatsAppButton: true,
      showQuickView: true,
      showFavorites: true,
      showCrossSell: true,
      showFilters: true,
      showFloatingWhatsApp: true,
      showAiConsultant: false,
      showPaymentMethods: true,
    },
  });

  useEffect(() => {
    if (tenant) {
      form.reset({
        catalogUsp: tenant.catalogUsp || "",
        showProductSpecs: tenant.showProductSpecs ?? true,
        showProductStock: tenant.showProductStock ?? true,
        showWhatsAppButton: tenant.showWhatsAppButton ?? true,
        showQuickView: tenant.showQuickView ?? true,
        showFavorites: tenant.showFavorites ?? true,
        showCrossSell: tenant.showCrossSell ?? true,
        showFilters: tenant.showFilters ?? true,
        showFloatingWhatsApp: tenant.showFloatingWhatsApp ?? true,
        showAiConsultant: tenant.showAiConsultant ?? false,
        showPaymentMethods: tenant.showPaymentMethods ?? true,
      });
    }
  }, [tenant, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: CatalogSettingsData) => {
      const res = await apiRequest("PATCH", "/api/tenant", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant"] });
      toast({
        title: "Сохранено",
        description: "Настройки каталога обновлены",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить настройки",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CatalogSettingsData) => {
    saveMutation.mutate(data);
  };

  const toggleTag = (tagId: string) => {
    setEnabledTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <PageLoader />
      </DashboardLayout>
    );
  }

  const catalogUspValue = form.watch("catalogUsp") || "";

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Настройки каталога</h1>
          <p className="text-muted-foreground mt-1">
            Управление отображением и функциями витрины
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                УТП в шапке каталога
              </CardTitle>
              <CardDescription>
                Краткое уникальное торговое предложение для привлечения клиентов
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Input
                  {...form.register("catalogUsp")}
                  placeholder="Например: Бесплатная доставка от 10 000 ₸"
                  maxLength={120}
                  data-testid="input-catalog-usp"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {catalogUspValue.length}/120 символов
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Карточка товара
              </CardTitle>
              <CardDescription>
                Настройте, какие элементы показывать на карточке товара
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Показывать характеристики</Label>
                  <p className="text-sm text-muted-foreground">Размер, цвет и другие параметры</p>
                </div>
                <Switch
                  checked={form.watch("showProductSpecs")}
                  onCheckedChange={(checked) => form.setValue("showProductSpecs", checked)}
                  data-testid="switch-show-specs"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Показывать наличие</Label>
                  <p className="text-sm text-muted-foreground">Информация о количестве товара</p>
                </div>
                <Switch
                  checked={form.watch("showProductStock")}
                  onCheckedChange={(checked) => form.setValue("showProductStock", checked)}
                  data-testid="switch-show-stock"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Кнопка WhatsApp</Label>
                  <p className="text-sm text-muted-foreground">Быстрая связь через мессенджер</p>
                </div>
                <Switch
                  checked={form.watch("showWhatsAppButton")}
                  onCheckedChange={(checked) => form.setValue("showWhatsAppButton", checked)}
                  data-testid="switch-show-whatsapp"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Быстрый просмотр</Label>
                  <p className="text-sm text-muted-foreground">Просмотр товара без перехода на страницу</p>
                </div>
                <Switch
                  checked={form.watch("showQuickView")}
                  onCheckedChange={(checked) => form.setValue("showQuickView", checked)}
                  data-testid="switch-show-quickview"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Избранное</Label>
                  <p className="text-sm text-muted-foreground">Возможность добавлять товары в избранное</p>
                </div>
                <Switch
                  checked={form.watch("showFavorites")}
                  onCheckedChange={(checked) => form.setValue("showFavorites", checked)}
                  data-testid="switch-show-favorites"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Показывать способы оплаты</Label>
                  <p className="text-sm text-muted-foreground">Иконки доступных способов оплаты</p>
                </div>
                <Switch
                  checked={form.watch("showPaymentMethods")}
                  onCheckedChange={(checked) => form.setValue("showPaymentMethods", checked)}
                  data-testid="switch-show-payment"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Теги товаров
              </CardTitle>
              <CardDescription>
                Бейджи для выделения товаров в каталоге
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {PRODUCT_TAGS.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className="transition-opacity"
                    data-testid={`tag-${tag.id}`}
                  >
                    <Badge
                      variant={enabledTags.includes(tag.id) ? "default" : "outline"}
                      className={enabledTags.includes(tag.id) ? tag.color + " text-white" : ""}
                    >
                      {tag.label}
                    </Badge>
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Включённые теги будут доступны при редактировании товаров
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Общие параметры витрины
              </CardTitle>
              <CardDescription>
                Дополнительные функции каталога
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Фильтры в каталоге</Label>
                  <p className="text-sm text-muted-foreground">Фильтрация по цене, размеру, цвету</p>
                </div>
                <Switch
                  checked={form.watch("showFilters")}
                  onCheckedChange={(checked) => form.setValue("showFilters", checked)}
                  data-testid="switch-show-filters"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Похожие товары</Label>
                  <p className="text-sm text-muted-foreground">Блок «С этим товаром покупают»</p>
                </div>
                <Switch
                  checked={form.watch("showCrossSell")}
                  onCheckedChange={(checked) => form.setValue("showCrossSell", checked)}
                  data-testid="switch-show-crosssell"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Плавающая кнопка WhatsApp</Label>
                  <p className="text-sm text-muted-foreground">Кнопка связи в углу экрана</p>
                </div>
                <Switch
                  checked={form.watch("showFloatingWhatsApp")}
                  onCheckedChange={(checked) => form.setValue("showFloatingWhatsApp", checked)}
                  data-testid="switch-show-floating-wa"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>AI-консультант</Label>
                  <p className="text-sm text-muted-foreground">Виджет AI-помощника на сайте</p>
                </div>
                <Switch
                  checked={form.watch("showAiConsultant")}
                  onCheckedChange={(checked) => form.setValue("showAiConsultant", checked)}
                  data-testid="switch-show-ai"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saveMutation.isPending}
              data-testid="button-save-catalog-settings"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Сохранить настройки
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
