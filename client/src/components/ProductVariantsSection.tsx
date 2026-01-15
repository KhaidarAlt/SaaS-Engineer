import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, ChevronDown, ChevronUp, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ProductVariant } from "@shared/schema";

interface ProductVariantsSectionProps {
  productId: string;
}

export function ProductVariantsSection({ productId }: ProductVariantsSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    sku: "",
    option1Name: "",
    option1Value: "",
    option2Name: "",
    option2Value: "",
    price: "",
    stockQty: 0,
  });

  const { data: variants, isLoading } = useQuery<ProductVariant[]>({
    queryKey: ["/api/products", productId, "variants"],
    enabled: !!productId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", `/api/products/${productId}/variants`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", productId, "variants"] });
      toast({ title: "Вариант создан" });
      setDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Ошибка создания", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return apiRequest("PUT", `/api/products/${productId}/variants/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", productId, "variants"] });
      toast({ title: "Вариант обновлён" });
      setDialogOpen(false);
      setEditingVariant(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "Ошибка обновления", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (variantId: string) => {
      return apiRequest("DELETE", `/api/products/${productId}/variants/${variantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", productId, "variants"] });
      toast({ title: "Вариант удалён" });
    },
    onError: () => {
      toast({ title: "Ошибка удаления", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      sku: "",
      option1Name: "",
      option1Value: "",
      option2Name: "",
      option2Value: "",
      price: "",
      stockQty: 0,
    });
  };

  const openEditDialog = (variant: ProductVariant) => {
    setEditingVariant(variant);
    setFormData({
      sku: variant.sku || "",
      option1Name: variant.option1Name || "",
      option1Value: variant.option1Value || "",
      option2Name: variant.option2Name || "",
      option2Value: variant.option2Value || "",
      price: variant.price || "",
      stockQty: variant.stockQty,
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingVariant(null);
    resetForm();
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVariant) {
      updateMutation.mutate({ id: editingVariant.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatPrice = (value: string | null) => {
    if (!value) return "—";
    return new Intl.NumberFormat("ru-KZ").format(parseFloat(value)) + " ₸";
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate flex flex-row items-center justify-between gap-2 py-4">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">
                Варианты товара
                {variants && variants.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {variants.length}
                  </Badge>
                )}
              </CardTitle>
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground mb-4">
              Добавьте варианты для разных размеров, цветов или других опций
            </p>

            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">
                Загрузка...
              </div>
            ) : variants && variants.length > 0 ? (
              <div className="space-y-2 mb-4">
                {variants.map((variant) => (
                  <div
                    key={variant.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {variant.option1Name && variant.option1Value && (
                          <Badge variant="outline">
                            {variant.option1Name}: {variant.option1Value}
                          </Badge>
                        )}
                        {variant.option2Name && variant.option2Value && (
                          <Badge variant="outline">
                            {variant.option2Name}: {variant.option2Value}
                          </Badge>
                        )}
                        {!variant.option1Name && !variant.option2Name && (
                          <span className="text-sm text-muted-foreground">
                            {variant.sku || "Без опций"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {variant.sku && <span>Арт: {variant.sku}</span>}
                        <span>Цена: {formatPrice(variant.price)}</span>
                        <span>Остаток: {variant.stockQty}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(variant)}
                        data-testid={`button-edit-variant-${variant.id}`}
                      >
                        Редактировать
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(variant.id)}
                        data-testid={`button-delete-variant-${variant.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground mb-4">
                Нет вариантов. Добавьте первый вариант.
              </div>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openCreateDialog}
                  data-testid="button-add-variant"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить вариант
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingVariant ? "Редактировать вариант" : "Новый вариант"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Опция 1 (название)</Label>
                      <Input
                        placeholder="Размер, Цвет..."
                        value={formData.option1Name}
                        onChange={(e) =>
                          setFormData({ ...formData, option1Name: e.target.value })
                        }
                        data-testid="input-option1-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Опция 1 (значение)</Label>
                      <Input
                        placeholder="M, L, XL или Красный..."
                        value={formData.option1Value}
                        onChange={(e) =>
                          setFormData({ ...formData, option1Value: e.target.value })
                        }
                        data-testid="input-option1-value"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Опция 2 (название)</Label>
                      <Input
                        placeholder="Необязательно"
                        value={formData.option2Name}
                        onChange={(e) =>
                          setFormData({ ...formData, option2Name: e.target.value })
                        }
                        data-testid="input-option2-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Опция 2 (значение)</Label>
                      <Input
                        placeholder="Необязательно"
                        value={formData.option2Value}
                        onChange={(e) =>
                          setFormData({ ...formData, option2Value: e.target.value })
                        }
                        data-testid="input-option2-value"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Артикул варианта</Label>
                    <Input
                      placeholder="Необязательно"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      data-testid="input-variant-sku"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Цена (переопределить)</Label>
                      <Input
                        type="number"
                        placeholder="Оставить пустым для базовой цены"
                        value={formData.price}
                        onChange={(e) =>
                          setFormData({ ...formData, price: e.target.value })
                        }
                        data-testid="input-variant-price"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Остаток</Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.stockQty}
                        onChange={(e) =>
                          setFormData({ ...formData, stockQty: parseInt(e.target.value) || 0 })
                        }
                        data-testid="input-variant-stock"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                    >
                      Отмена
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-save-variant"
                    >
                      {editingVariant ? "Сохранить" : "Создать"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
