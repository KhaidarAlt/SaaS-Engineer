import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Package, Wand2, Plus, X, Palette } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageLoader } from "@/components/LoadingSpinner";
import { ProductVariantsSection } from "@/components/ProductVariantsSection";
import { ProductImagesSection } from "@/components/ProductImagesSection";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Product, Category } from "@shared/schema";

const CLOTHING_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"];
const SHOE_SIZES = ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48"];
const PRESET_COLORS = [
  { name: "Белый", hex: "#FFFFFF" },
  { name: "Чёрный", hex: "#000000" },
  { name: "Серый", hex: "#808080" },
  { name: "Красный", hex: "#EF4444" },
  { name: "Синий", hex: "#3B82F6" },
  { name: "Зелёный", hex: "#22C55E" },
  { name: "Жёлтый", hex: "#EAB308" },
  { name: "Розовый", hex: "#EC4899" },
  { name: "Фиолетовый", hex: "#A855F7" },
  { name: "Оранжевый", hex: "#F97316" },
  { name: "Бежевый", hex: "#D4B896" },
  { name: "Коричневый", hex: "#8B4513" },
  { name: "Бордовый", hex: "#800020" },
  { name: "Тёмно-синий", hex: "#1E3A5F" },
  { name: "Голубой", hex: "#87CEEB" },
];

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
  sizes: z.array(z.string()).optional(),
  colors: z.array(z.object({ name: z.string(), hex: z.string() })).optional(),
});

type ProductFormData = z.infer<typeof productFormSchema>;

function generateSKU(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SKU-${timestamp}-${random}`;
}

export default function ProductFormPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/dashboard/products/:id");
  const isEdit = match && params?.id !== "new";
  const productId = isEdit ? params?.id : null;
  const { toast } = useToast();

  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<{name: string; hex: string}[]>([]);
  const [customColorName, setCustomColorName] = useState("");
  const [customColorHex, setCustomColorHex] = useState("#000000");
  const [sizeType, setSizeType] = useState<"clothing" | "shoes">("clothing");

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
      sizes: [],
      colors: [],
    },
  });

  useEffect(() => {
    if (product) {
      const productSizes = (product as any).sizes || [];
      const productColors = (product as any).colors || [];
      
      setSelectedSizes(productSizes);
      setSelectedColors(productColors);
      
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
        sizes: productSizes,
        colors: productColors,
      });
    }
  }, [product, form]);

  const mutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const payload = {
        ...data,
        sizes: selectedSizes,
        colors: selectedColors,
      };
      if (isEdit && productId) {
        return apiRequest("PUT", `/api/products/${productId}`, payload);
      }
      return apiRequest("POST", "/api/products", payload);
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

  const handleGenerateSKU = () => {
    const newSKU = generateSKU();
    form.setValue("sku", newSKU);
  };

  const toggleSize = (size: string) => {
    setSelectedSizes(prev => 
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    );
  };

  const toggleColor = (color: {name: string; hex: string}) => {
    setSelectedColors(prev => {
      const exists = prev.find(c => c.hex === color.hex);
      if (exists) {
        return prev.filter(c => c.hex !== color.hex);
      }
      return [...prev, color];
    });
  };

  const addCustomColor = () => {
    if (customColorName.trim() && customColorHex) {
      const newColor = { name: customColorName.trim(), hex: customColorHex };
      if (!selectedColors.find(c => c.hex === newColor.hex)) {
        setSelectedColors(prev => [...prev, newColor]);
      }
      setCustomColorName("");
      setCustomColorHex("#000000");
    }
  };

  const removeColor = (hex: string) => {
    setSelectedColors(prev => prev.filter(c => c.hex !== hex));
  };

  if (productLoading && isEdit) {
    return <PageLoader />;
  }

  const sizesArray = sizeType === "clothing" ? CLOTHING_SIZES : SHOE_SIZES;

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
                  <div className="flex gap-2">
                    <Input
                      id="sku"
                      placeholder="например: SKU-001"
                      {...form.register("sku")}
                      data-testid="input-sku"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleGenerateSKU}
                      title="Сгенерировать автоматически"
                      data-testid="button-generate-sku"
                    >
                      <Wand2 className="h-4 w-4" />
                    </Button>
                  </div>
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
              <CardTitle className="text-lg">Размеры</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 mb-3">
                <Button
                  type="button"
                  variant={sizeType === "clothing" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSizeType("clothing")}
                  data-testid="button-size-clothing"
                >
                  Одежда
                </Button>
                <Button
                  type="button"
                  variant={sizeType === "shoes" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSizeType("shoes")}
                  data-testid="button-size-shoes"
                >
                  Обувь
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {sizesArray.map((size) => (
                  <Badge
                    key={size}
                    variant={selectedSizes.includes(size) ? "default" : "outline"}
                    className="cursor-pointer hover-elevate px-3 py-1"
                    onClick={() => toggleSize(size)}
                    data-testid={`badge-size-${size}`}
                  >
                    {size}
                  </Badge>
                ))}
              </div>
              
              {selectedSizes.length > 0 && (
                <div className="pt-2">
                  <Label className="text-xs text-muted-foreground">Выбранные размеры:</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedSizes.map((size) => (
                      <Badge key={size} variant="secondary" className="text-xs">
                        {size}
                        <button
                          type="button"
                          onClick={() => toggleSize(size)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Цвета
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => toggleColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      selectedColors.find(c => c.hex === color.hex)
                        ? "ring-2 ring-primary ring-offset-2"
                        : "border-border"
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                    data-testid={`button-color-${color.name}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm" data-testid="button-add-custom-color">
                      <Plus className="h-4 w-4 mr-1" />
                      Свой цвет
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Название</Label>
                        <Input
                          value={customColorName}
                          onChange={(e) => setCustomColorName(e.target.value)}
                          placeholder="например: Мятный"
                          className="h-8"
                          data-testid="input-custom-color-name"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Цвет</Label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={customColorHex}
                            onChange={(e) => setCustomColorHex(e.target.value)}
                            className="w-10 h-8 rounded cursor-pointer"
                            data-testid="input-custom-color-hex"
                          />
                          <Input
                            value={customColorHex}
                            onChange={(e) => setCustomColorHex(e.target.value)}
                            className="h-8 flex-1 font-mono text-xs"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={addCustomColor}
                        className="w-full"
                        data-testid="button-confirm-custom-color"
                      >
                        Добавить
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {selectedColors.length > 0 && (
                <div className="pt-2">
                  <Label className="text-xs text-muted-foreground">Выбранные цвета:</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedColors.map((color) => (
                      <Badge
                        key={color.hex}
                        variant="secondary"
                        className="flex items-center gap-2 pr-1"
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-border"
                          style={{ backgroundColor: color.hex }}
                        />
                        {color.name}
                        <button
                          type="button"
                          onClick={() => removeColor(color.hex)}
                          className="hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
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
          <>
            <ProductImagesSection productId={productId} />
            <ProductVariantsSection productId={productId} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
