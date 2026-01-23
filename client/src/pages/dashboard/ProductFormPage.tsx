import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Package, Wand2, Plus, X, Palette, Users } from "lucide-react";
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
import { InlineProductImages, InlineProductImagesRef } from "@/components/InlineProductImages";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Product, Category } from "@shared/schema";

const CLOTHING_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"];
const SHOE_SIZES = ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48"];
const KIDS_CLOTHING_SIZES = ["56", "62", "68", "74", "80", "86", "92", "98", "104", "110", "116", "122", "128", "134", "140", "146", "152", "158", "164"];
const KIDS_SHOE_SIZES = ["16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34"];

const GENDER_OPTIONS = [
  { value: "male", label: "Мужской" },
  { value: "female", label: "Женский" },
  { value: "kids", label: "Детский" },
];

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
  gender: z.string().optional(),
  sizes: z.array(z.object({ size: z.string(), qty: z.number() })).optional(),
  colors: z.array(z.object({ name: z.string(), hex: z.string() })).optional(),
});

type ProductFormData = z.infer<typeof productFormSchema>;

interface SizeWithQty {
  size: string;
  qty: number;
}

interface SizeColorStock {
  size: string;
  colorHex: string;
  qty: number;
}

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
  const inlineImagesRef = useRef<InlineProductImagesRef>(null);

  const [selectedSizes, setSelectedSizes] = useState<SizeWithQty[]>([]);
  const [selectedColors, setSelectedColors] = useState<{name: string; hex: string}[]>([]);
  const [sizeColorStock, setSizeColorStock] = useState<SizeColorStock[]>([]);
  const [selectedGender, setSelectedGender] = useState<string>("");
  const [customColorName, setCustomColorName] = useState("");
  const [customColorHex, setCustomColorHex] = useState("#000000");
  const [sizeType, setSizeType] = useState<"clothing" | "shoes" | "kids_clothing" | "kids_shoes">("clothing");

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
      gender: "",
      sizes: [],
      colors: [],
    },
  });

  useEffect(() => {
    if (product) {
      const productSizes = (product as any).sizes || [];
      const productColors = (product as any).colors || [];
      const productGender = (product as any).gender || "";
      const productSizeColorStock = (product as any).sizeColorStock || [];
      
      setSelectedSizes(productSizes);
      setSelectedColors(productColors);
      setSelectedGender(productGender);
      setSizeColorStock(productSizeColorStock);
      
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
        gender: productGender,
        sizes: productSizes,
        colors: productColors,
      });
    }
  }, [product, form]);

  const [createdProductId, setCreatedProductId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const payload = {
        ...data,
        gender: selectedGender || null,
        sizes: selectedSizes,
        colors: selectedColors,
        sizeColorStock: sizeColorStock,
      };
      if (isEdit && productId) {
        return apiRequest("PUT", `/api/products/${productId}`, payload);
      }
      
      // Wait for image compression to complete before creating product
      if (inlineImagesRef.current?.isCompressing()) {
        await inlineImagesRef.current.waitForCompression();
      }
      
      const response = await apiRequest("POST", "/api/products", payload);
      const newProduct = await response.json();
      setCreatedProductId(newProduct.id);
      
      if (inlineImagesRef.current?.hasImages()) {
        try {
          await inlineImagesRef.current.uploadImages(newProduct.id);
        } catch {
          throw new Error("IMAGE_UPLOAD_FAILED");
        }
      }
      
      return newProduct;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: isEdit ? "Товар обновлён" : "Товар создан",
      });
      setLocation("/dashboard/products");
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "IMAGE_UPLOAD_FAILED") {
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        toast({
          title: "Товар создан, но изображения не загружены",
          description: "Вы можете добавить изображения на странице редактирования товара",
          variant: "destructive",
        });
        // Redirect to edit page so user can retry adding images
        if (createdProductId) {
          setLocation(`/dashboard/products/${createdProductId}`);
        }
        return;
      }
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
    setSelectedSizes(prev => {
      const exists = prev.find(s => s.size === size);
      if (exists) {
        setSizeColorStock(stock => stock.filter(s => s.size !== size));
        return prev.filter(s => s.size !== size);
      }
      return [...prev, { size, qty: 0 }];
    });
  };

  const updateSizeQty = (size: string, qty: number) => {
    setSelectedSizes(prev => 
      prev.map(s => s.size === size ? { ...s, qty: Math.max(0, qty) } : s)
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
    setSizeColorStock(prev => prev.filter(s => s.colorHex !== hex));
  };

  const getSizeColorQty = (size: string, colorHex: string): number => {
    const item = sizeColorStock.find(s => s.size === size && s.colorHex === colorHex);
    return item?.qty ?? 0;
  };

  const updateSizeColorQty = (size: string, colorHex: string, qty: number) => {
    setSizeColorStock(prev => {
      const exists = prev.find(s => s.size === size && s.colorHex === colorHex);
      if (exists) {
        return prev.map(s => s.size === size && s.colorHex === colorHex ? { ...s, qty: Math.max(0, qty) } : s);
      }
      return [...prev, { size, colorHex, qty: Math.max(0, qty) }];
    });
  };

  if (productLoading && isEdit) {
    return <PageLoader />;
  }

  const getSizesArray = () => {
    switch (sizeType) {
      case "clothing": return CLOTHING_SIZES;
      case "shoes": return SHOE_SIZES;
      case "kids_clothing": return KIDS_CLOTHING_SIZES;
      case "kids_shoes": return KIDS_SHOE_SIZES;
      default: return CLOTHING_SIZES;
    }
  };

  const sizesArray = getSizesArray();

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
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Для кого
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {GENDER_OPTIONS.map((option) => (
                  <Badge
                    key={option.value}
                    variant={selectedGender === option.value ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setSelectedGender(prev => prev === option.value ? "" : option.value)}
                    data-testid={`badge-gender-${option.value}`}
                  >
                    {option.label}
                  </Badge>
                ))}
              </div>
              {selectedGender && (
                <p className="text-xs text-muted-foreground mt-2">
                  Выбрано: {GENDER_OPTIONS.find(g => g.value === selectedGender)?.label}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Размеры</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 mb-3">
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
                <Button
                  type="button"
                  variant={sizeType === "kids_clothing" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSizeType("kids_clothing")}
                  data-testid="button-size-kids-clothing"
                >
                  Детская одежда
                </Button>
                <Button
                  type="button"
                  variant={sizeType === "kids_shoes" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSizeType("kids_shoes")}
                  data-testid="button-size-kids-shoes"
                >
                  Детская обувь
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {sizesArray.map((size) => {
                  const selected = selectedSizes.find(s => s.size === size);
                  return (
                    <Badge
                      key={size}
                      variant={selected ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleSize(size)}
                      data-testid={`badge-size-${size}`}
                    >
                      {size}
                    </Badge>
                  );
                })}
              </div>
              
              {selectedSizes.length > 0 && selectedColors.length === 0 && (
                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium mb-3 block">Количество по размерам:</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {selectedSizes.map((sizeItem) => (
                      <div key={sizeItem.size} className="flex items-center gap-2 p-2 border rounded-lg">
                        <span className="font-medium text-sm min-w-[40px]">{sizeItem.size}</span>
                        <Input
                          type="number"
                          min="0"
                          value={sizeItem.qty}
                          onChange={(e) => updateSizeQty(sizeItem.size, parseInt(e.target.value) || 0)}
                          className="h-8 w-20 text-center"
                          data-testid={`input-size-qty-${sizeItem.size}`}
                        />
                        <span className="text-xs text-muted-foreground">шт</span>
                        <button
                          type="button"
                          onClick={() => toggleSize(sizeItem.size)}
                          className="text-muted-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Общее количество: {selectedSizes.reduce((sum, s) => sum + s.qty, 0)} шт
                  </p>
                </div>
              )}
              
              {selectedSizes.length > 0 && selectedColors.length > 0 && (
                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium mb-3 block">Количество по размерам и цветам:</Label>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="border p-2 bg-muted text-left">Размер</th>
                          {selectedColors.map(color => (
                            <th key={color.hex} className="border p-2 bg-muted">
                              <div className="flex items-center justify-center gap-1">
                                <span
                                  className="w-4 h-4 rounded-full border border-border"
                                  style={{ backgroundColor: color.hex }}
                                />
                                <span className="text-xs">{color.name}</span>
                              </div>
                            </th>
                          ))}
                          <th className="border p-2 bg-muted text-center text-xs">Итого</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSizes.map(sizeItem => (
                          <tr key={sizeItem.size}>
                            <td className="border p-2 font-medium">{sizeItem.size}</td>
                            {selectedColors.map(color => (
                              <td key={color.hex} className="border p-1">
                                <Input
                                  type="number"
                                  min="0"
                                  value={getSizeColorQty(sizeItem.size, color.hex)}
                                  onChange={(e) => updateSizeColorQty(sizeItem.size, color.hex, parseInt(e.target.value) || 0)}
                                  className="h-8 w-16 text-center mx-auto"
                                  data-testid={`input-stock-${sizeItem.size}-${color.name}`}
                                />
                              </td>
                            ))}
                            <td className="border p-2 text-center text-muted-foreground text-xs">
                              {selectedColors.reduce((sum, c) => sum + getSizeColorQty(sizeItem.size, c.hex), 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td className="border p-2 font-medium bg-muted">Итого</td>
                          {selectedColors.map(color => (
                            <td key={color.hex} className="border p-2 text-center bg-muted text-xs">
                              {selectedSizes.reduce((sum, s) => sum + getSizeColorQty(s.size, color.hex), 0)}
                            </td>
                          ))}
                          <td className="border p-2 text-center font-medium bg-muted">
                            {sizeColorStock.reduce((sum, s) => sum + s.qty, 0)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Общее количество: {sizeColorStock.reduce((sum, s) => sum + s.qty, 0)} шт
                  </p>
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
                <Label htmlFor="stockQty">Общее количество на складе</Label>
                <Input
                  id="stockQty"
                  type="number"
                  min="0"
                  {...form.register("stockQty")}
                  data-testid="input-stock"
                />
                <p className="text-xs text-muted-foreground">
                  Это поле используется если размеры не указаны
                </p>
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

        {!isEdit && (
          <Card>
            <CardContent className="pt-6">
              <InlineProductImages ref={inlineImagesRef} />
            </CardContent>
          </Card>
        )}

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
