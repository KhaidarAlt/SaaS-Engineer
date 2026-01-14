import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Percent, MoreHorizontal, Calendar } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CardSkeleton } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Discount, Product, Category } from "@shared/schema";

const discountFormSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  scope: z.enum(["product", "category"]),
  scopeId: z.string().optional(),
  type: z.enum(["percent", "amount"]),
  value: z.string().min(1, "Значение обязательно"),
  priority: z.coerce.number().min(0),
  isActive: z.boolean(),
});

type DiscountFormData = z.infer<typeof discountFormSchema>;

export default function DiscountsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const { toast } = useToast();

  const { data: discounts, isLoading } = useQuery<Discount[]>({
    queryKey: ["/api/discounts"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const form = useForm<DiscountFormData>({
    resolver: zodResolver(discountFormSchema),
    defaultValues: {
      name: "",
      scope: "product",
      scopeId: "",
      type: "percent",
      value: "",
      priority: 0,
      isActive: true,
    },
  });

  const scope = form.watch("scope");

  const createMutation = useMutation({
    mutationFn: async (data: DiscountFormData) => {
      return apiRequest("POST", "/api/discounts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discounts"] });
      toast({ title: "Скидка создана" });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Ошибка создания", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DiscountFormData }) => {
      return apiRequest("PUT", `/api/discounts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discounts"] });
      toast({ title: "Скидка обновлена" });
      setDialogOpen(false);
      setEditingDiscount(null);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/discounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discounts"] });
      toast({ title: "Скидка удалена" });
    },
  });

  const openEditDialog = (discount: Discount) => {
    setEditingDiscount(discount);
    form.reset({
      name: discount.name,
      scope: discount.scope as "product" | "category",
      scopeId: discount.scopeId || "",
      type: discount.type as "percent" | "amount",
      value: discount.value,
      priority: discount.priority,
      isActive: discount.isActive,
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingDiscount(null);
    form.reset({
      name: "",
      scope: "product",
      scopeId: "",
      type: "percent",
      value: "",
      priority: 0,
      isActive: true,
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: DiscountFormData) => {
    if (editingDiscount) {
      updateMutation.mutate({ id: editingDiscount.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getScopeName = (discount: Discount) => {
    if (discount.scope === "product") {
      const product = products?.find((p) => p.id === discount.scopeId);
      return product?.name || "Все товары";
    }
    const category = categories?.find((c) => c.id === discount.scopeId);
    return category?.name || "Все категории";
  };

  const formatValue = (discount: Discount) => {
    if (discount.type === "percent") {
      return `-${discount.value}%`;
    }
    return `-${new Intl.NumberFormat("ru-KZ").format(parseFloat(discount.value))} ₸`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Скидки</h1>
            <p className="text-muted-foreground">
              Настройте скидки для товаров и категорий
            </p>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-add-discount">
            <Plus className="h-4 w-4 mr-2" />
            Создать скидку
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : discounts && discounts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {discounts.map((discount, index) => (
              <motion.div
                key={discount.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="hover-elevate">
                  <CardHeader className="flex flex-row items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <Percent className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{discount.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {getScopeName(discount)}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(discount)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Редактировать
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(discount.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-green-500">
                        {formatValue(discount)}
                      </span>
                      <Badge variant={discount.isActive ? "default" : "secondary"}>
                        {discount.isActive ? "Активна" : "Неактивна"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <Percent className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="font-medium">Нет скидок</p>
              <p className="text-sm text-muted-foreground mb-4">
                Создайте скидки для привлечения клиентов
              </p>
              <Button onClick={openCreateDialog} data-testid="button-add-first-discount">
                <Plus className="h-4 w-4 mr-2" />
                Создать скидку
              </Button>
            </CardContent>
          </Card>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingDiscount ? "Редактировать скидку" : "Новая скидка"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Название *</Label>
                <Input
                  id="name"
                  placeholder="Скидка выходного дня"
                  {...form.register("name")}
                  data-testid="input-discount-name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Область применения</Label>
                  <Select
                    value={form.watch("scope")}
                    onValueChange={(value) =>
                      form.setValue("scope", value as "product" | "category")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">Товар</SelectItem>
                      <SelectItem value="category">Категория</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{scope === "product" ? "Товар" : "Категория"}</Label>
                  <Select
                    value={form.watch("scopeId") || ""}
                    onValueChange={(value) => form.setValue("scopeId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите..." />
                    </SelectTrigger>
                    <SelectContent>
                      {scope === "product"
                        ? products?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))
                        : categories?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Тип скидки</Label>
                  <Select
                    value={form.watch("type")}
                    onValueChange={(value) =>
                      form.setValue("type", value as "percent" | "amount")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Процент (%)</SelectItem>
                      <SelectItem value="amount">Сумма (₸)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="value">Значение *</Label>
                  <Input
                    id="value"
                    type="number"
                    placeholder="10"
                    {...form.register("value")}
                    data-testid="input-discount-value"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label htmlFor="isActive">Активна</Label>
                  <p className="text-sm text-muted-foreground">
                    Применять скидку к товарам
                  </p>
                </div>
                <Switch
                  id="isActive"
                  checked={form.watch("isActive")}
                  onCheckedChange={(checked) => form.setValue("isActive", checked)}
                />
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
                  data-testid="button-save-discount"
                >
                  {editingDiscount ? "Сохранить" : "Создать"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
