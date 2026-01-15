import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Package } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageLoader } from "@/components/LoadingSpinner";
import { ProductVariantsSection } from "@/components/ProductVariantsSection";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Product, Category } from "@shared/schema";

const productFormSchema = z.object({
  sku: z.string().min(1, "Артикул обязателен"),
  name: z.string().min(1, "Название обязательно"),
  description: z.string().optional(),
  price: z.string().min(1, "Цена обязательна"),
  categoryId: z.string().optional(),
  stockQty: z.coerce.number().min(0),
  inStock: z.boolean(),
  alwaysInStock: z.boolean(),
  isActive: z.boolean(),
  mainImageUrl: z.string().optional(),
});

type ProductFormData = z.infer<typeof productFormSchema>;

export default function ProductFormPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/dashboard/products/:id");
  const isEdit = match && params?.id !== "new";
  const productId = isEdit ? params?.id : null;
  const { toast } = useToast();

  const { data: product, isLoading: productLoading } = useQuery<Product>({
    queryKey: ["/api/products", productId],
    enabled: !!productId,
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      sku: "",
      name: "",
      description: "",
      price: "",
      categoryId: "",
      stockQty: 0,
      inStock: true,
      alwaysInStock: false,
      isActive: true,
      mainImageUrl: "",
    },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        sku: product.sku,
        name: product.name,
        description: product.description || "",
        price: product.price,
        categoryId: product.categoryId || "",
        stockQty: product.stockQty,
        inStock: product.inStock,
        alwaysInStock: product.alwaysInStock,
        isActive: product.isActive,
        mainImageUrl: product.mainImageUrl || "",
      });
    }
  }, [product, form]);

  const mutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      if (isEdit && productId) {
        return apiRequest("PUT", `/api/products/${productId}`, data);
      }
      return apiRequest("POST", "/api/products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: isEdit ? "Товар обновлён" : "Товар создан",
      });
      setLocation("/dashboard/products");
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Попробуйте позже",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProductFormData) => {
    mutation.mutate(data);
  };

  if (productLoading && isEdit) {
    return <PageLoader />;
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/dashboard/products")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isEdit ? "Редактировать товар" : "Новый товар"}
            </h1>
            <p className="text-muted-foreground">
              {isEdit ? "Измените данные товара" : "Заполните информацию о товаре"}
            </p>
          </div>
        </motion.div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Основная информация
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">Артикул (SKU) *</Label>
                  <Input
                    id="sku"
                    placeholder="например: SKU-001"
                    {...form.register("sku")}
                    data-testid="input-sku"
                  />
                  {form.formState.errors.sku && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.sku.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Цена (₸) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...form.register("price")}
                    data-testid="input-price"
                  />
                  {form.formState.errors.price && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.price.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Название *</Label>
                <Input
                  id="name"
                  placeholder="Название товара"
                  {...form.register("name")}
                  data-testid="input-name"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  placeholder="Описание товара..."
                  rows={4}
                  {...form.register("description")}
                  data-testid="input-description"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoryId">Категория</Label>
                <Select
                  value={form.watch("categoryId")}
                  onValueChange={(value) => form.setValue("categoryId", value)}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mainImageUrl">URL изображения</Label>
                <Input
                  id="mainImageUrl"
                  placeholder="https://..."
                  {...form.register("mainImageUrl")}
                  data-testid="input-image"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Наличие и статус</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stockQty">Количество на складе</Label>
                <Input
                  id="stockQty"
                  type="number"
                  min="0"
                  {...form.register("stockQty")}
                  data-testid="input-stock"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label htmlFor="alwaysInStock">Всегда в наличии</Label>
                  <p className="text-sm text-muted-foreground">
                    Товар всегда показывается как доступный
                  </p>
                </div>
                <Switch
                  id="alwaysInStock"
                  checked={form.watch("alwaysInStock")}
                  onCheckedChange={(checked) => form.setValue("alwaysInStock", checked)}
                  data-testid="switch-always-in-stock"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label htmlFor="inStock">В наличии</Label>
                  <p className="text-sm text-muted-foreground">
                    Ручное управление наличием
                  </p>
                </div>
                <Switch
                  id="inStock"
                  checked={form.watch("inStock")}
                  onCheckedChange={(checked) => form.setValue("inStock", checked)}
                  data-testid="switch-in-stock"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label htmlFor="isActive">Активен</Label>
                  <p className="text-sm text-muted-foreground">
                    Показывать товар в каталоге
                  </p>
                </div>
                <Switch
                  id="isActive"
                  checked={form.watch("isActive")}
                  onCheckedChange={(checked) => form.setValue("isActive", checked)}
                  data-testid="switch-active"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/dashboard/products")}
              data-testid="button-cancel"
            >
              Отмена
            </Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save">
              {mutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                  Сохранение...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {isEdit ? "Сохранить" : "Создать"}
                </span>
              )}
            </Button>
          </div>
        </form>

        {isEdit && productId && (
          <ProductVariantsSection productId={productId} />
        )}
      </div>
    </DashboardLayout>
  );
}
