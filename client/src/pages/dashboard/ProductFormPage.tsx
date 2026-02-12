import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Package, Wand2, Plus, X, Palette, Users, Tag, UtensilsCrossed, Video, Upload, Loader2, Image as ImageIcon } from "lucide-react";
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
import { AiDescriptionGenerator } from "@/components/AiDescriptionGenerator";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageLoader } from "@/components/LoadingSpinner";
import { ProductVariantsSection } from "@/components/ProductVariantsSection";
import { ProductImagesSection } from "@/components/ProductImagesSection";
import { InlineProductImages, InlineProductImagesRef } from "@/components/InlineProductImages";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Product, Category } from "@shared/schema";
import type { CatalogTemplateType } from "@shared/templateRegistry";
import { UNIT_OPTIONS } from "@shared/templateRegistry";

const CLOTHING_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"];
const SHOE_SIZES = ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48"];
const KIDS_CLOTHING_SIZES = ["56", "62", "68", "74", "80", "86", "92", "98", "104", "110", "116", "122", "128", "134", "140", "146", "152", "158", "164"];
const KIDS_SHOE_SIZES = ["16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34"];
const BABY_SIZES = ["0-3м", "3-6м", "6-9м", "9-12м", "12-18м", "18-24м"];
const KIDS_HEIGHT_SIZES = ["50", "56", "62", "68", "74", "80", "86", "92", "98", "104", "110", "116", "122", "128", "134", "140", "146", "152", "158", "164", "170"];

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

const PRODUCT_TAGS = [
  { id: "hit", label: "Хит продаж", color: "bg-orange-500" },
  { id: "new", label: "Новинка", color: "bg-green-500" },
  { id: "best_price", label: "Лучшая цена", color: "bg-blue-500" },
  { id: "sale", label: "Скидка", color: "bg-red-500" },
  { id: "delivery_today", label: "Доставка сегодня", color: "bg-purple-500" },
  { id: "in_stock", label: "В наличии", color: "bg-emerald-500" },
  { id: "low_stock", label: "Осталось мало", color: "bg-amber-500" },
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
  tags: z.array(z.string()).optional(),
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
  const [isCompressingImages, setIsCompressingImages] = useState(false);

  const [selectedSizes, setSelectedSizes] = useState<SizeWithQty[]>([]);
  const [selectedColors, setSelectedColors] = useState<{name: string; hex: string}[]>([]);
  const [sizeColorStock, setSizeColorStock] = useState<SizeColorStock[]>([]);
  const [selectedGender, setSelectedGender] = useState<string>("");
  const [customColorName, setCustomColorName] = useState("");
  const [customColorHex, setCustomColorHex] = useState("#000000");
  const [sizeType, setSizeType] = useState<"clothing" | "shoes" | "kids_clothing" | "kids_shoes" | "baby" | "kids_height">("clothing");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [ingredients, setIngredients] = useState("");
  const [portionSize, setPortionSize] = useState("");
  const [weight, setWeight] = useState("");
  const [cookingTime, setCookingTime] = useState<number | undefined>();
  const [calories, setCalories] = useState<number | undefined>();
  const [allergens, setAllergens] = useState<string[]>([]);
  const [modifiers, setModifiers] = useState<{name: string; options: {label: string; price: number}[]}[]>([]);

  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoFormat, setVideoFormat] = useState<string>("");
  const [videoPosterUrl, setVideoPosterUrl] = useState<string>("");
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState("");
  const [autoGeneratePoster, setAutoGeneratePoster] = useState(true);

  const [brand, setBrand] = useState("");
  const [unitOfMeasure, setUnitOfMeasure] = useState("шт");
  const [specs, setSpecs] = useState<{name: string; value: string}[]>([]);

  const { data: product, isLoading: productLoading } = useQuery<Product>({
    queryKey: ["/api/products", productId],
    enabled: !!productId,
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: tenant } = useQuery<any>({
    queryKey: ["/api/tenant"],
  });
  const catalogTemplate = (tenant?.catalogTemplate || "universal") as CatalogTemplateType;

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
      const productTags = (product as any).tags || [];
      
      setSelectedSizes(productSizes);
      setSelectedColors(productColors);
      setSelectedGender(productGender);
      setSizeColorStock(productSizeColorStock);
      setSelectedTags(productTags);

      setBrand((product as any).brand || "");
      setUnitOfMeasure((product as any).unitOfMeasure || "шт");
      setSpecs((product as any).specs || []);

      setIngredients((product as any).ingredients || "");
      setPortionSize((product as any).portionSize || "");
      setWeight((product as any).weight || "");
      setCookingTime((product as any).cookingTime || undefined);
      setCalories((product as any).calories || undefined);
      setAllergens((product as any).allergens || []);
      setModifiers((product as any).modifiers || []);

      setVideoUrl((product as any).videoUrl || "");
      setVideoFormat((product as any).videoFormat || "");
      setVideoPosterUrl((product as any).videoPosterUrl || "");
      
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
        tags: productTags,
      });
    }
  }, [product, form]);

  const mutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const payload: Record<string, any> = {
        ...data,
        tags: selectedTags,
        videoUrl: videoUrl || null,
        videoFormat: videoFormat || null,
        videoPosterUrl: videoPosterUrl || null,
      };
      
      if (catalogTemplate === "fashion") {
        payload.gender = selectedGender || null;
        payload.sizes = selectedSizes;
        payload.colors = selectedColors;
        payload.sizeColorStock = sizeColorStock;
      } else if (catalogTemplate === "universal") {
        payload.brand = brand || null;
        payload.unitOfMeasure = unitOfMeasure || null;
        payload.specs = specs.length > 0 ? specs : null;
        payload.colors = selectedColors;
      } else if (catalogTemplate === "food") {
        payload.ingredients = ingredients || null;
        payload.modifiers = modifiers.length > 0 ? modifiers : null;
        payload.portionSize = portionSize || null;
        payload.cookingTime = cookingTime || null;
        payload.weight = weight || null;
        payload.calories = calories || null;
        payload.allergens = allergens.length > 0 ? allergens : null;
      }
      if (isEdit && productId) {
        return apiRequest("PUT", `/api/products/${productId}`, payload);
      }
      
      // Wait for image compression to complete before creating product
      if (inlineImagesRef.current?.isCompressing()) {
        await inlineImagesRef.current.waitForCompression();
      }
      
      const response = await apiRequest("POST", "/api/products", payload);
      const newProduct = await response.json();
      
      if (inlineImagesRef.current?.hasImages()) {
        try {
          await inlineImagesRef.current.uploadImages(newProduct.id);
        } catch {
          // Throw error with product ID so we can redirect to edit page
          throw new Error(`IMAGE_UPLOAD_FAILED:${newProduct.id}`);
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
      if (error instanceof Error && error.message.startsWith("IMAGE_UPLOAD_FAILED:")) {
        const newProductId = error.message.split(":")[1];
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        toast({
          title: "Товар создан, но изображения не загружены",
          description: "Вы можете добавить изображения на странице редактирования товара",
          variant: "destructive",
        });
        // Redirect to edit page so user can retry adding images
        setLocation(`/dashboard/products/${newProductId}`);
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

  const normalizeMediaUrl = (url: string | null | undefined): string => {
    if (!url) return "";
    if (url.startsWith("http") || url.startsWith("/")) return url;
    return `/objects/${url}`;
  };

  const getVideoFormats = (): {value: string; label: string}[] => {
    switch (catalogTemplate) {
      case "universal": return [
        { value: "16:9", label: "Горизонтальный (16:9)" },
        { value: "1:1", label: "Квадратный (1:1)" },
      ];
      case "fashion": return [
        { value: "9:16", label: "Вертикальный (9:16)" },
      ];
      case "food": return [
        { value: "1:1", label: "Квадратный (1:1)" },
      ];
      default: return [{ value: "16:9", label: "Горизонтальный (16:9)" }];
    }
  };

  const getMaxDuration = (): number => {
    return catalogTemplate === "universal" ? 30 : 15;
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Неверный формат", description: "Только MP4, MOV, WebM, AVI", variant: "destructive" });
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "Файл слишком большой", description: "Максимум 50MB для видео", variant: "destructive" });
      return;
    }

    const formats = getVideoFormats();
    const selectedFormat = videoFormat || formats[0].value;
    if (!videoFormat) setVideoFormat(selectedFormat);

    setIsUploadingVideo(true);
    setVideoUploadProgress("Оптимизация видео...");

    try {
      const response = await fetch("/api/uploads/product-video", {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "X-Original-Filename": encodeURIComponent(file.name),
          "X-Aspect-Ratio": selectedFormat,
          "X-Generate-Poster": autoGeneratePoster ? "true" : "false",
          "X-Max-Duration": String(getMaxDuration()),
        },
        credentials: "include",
        body: file,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Ошибка загрузки видео");
      }

      const result = await response.json();
      setVideoUrl(result.videoPath);
      setVideoFormat(result.aspectRatio);
      if (result.posterPath) {
        setVideoPosterUrl(result.posterPath);
      }

      setVideoUploadProgress("");
      toast({
        title: "Видео загружено",
        description: `Сжатие: ${result.savedPercent}%`,
      });
    } catch (error: any) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
      setVideoUploadProgress("");
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleRemoveVideo = () => {
    setVideoUrl("");
    setVideoFormat("");
    setVideoPosterUrl("");
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
      case "baby": return BABY_SIZES;
      case "kids_height": return KIDS_HEIGHT_SIZES;
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
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label htmlFor="description">Описание</Label>
                  <AiDescriptionGenerator
                    productName={form.watch("name") || ""}
                    category={categories?.find(c => c.id === form.watch("categoryId"))?.name}
                    price={form.watch("price")}
                    currentText={form.watch("description")}
                    onInsert={(text) => form.setValue("description", text, { shouldDirty: true })}
                  />
                </div>
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

          {catalogTemplate === "fashion" && (
          <>
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
                <Button
                  type="button"
                  variant={sizeType === "baby" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSizeType("baby")}
                  data-testid="button-size-baby"
                >
                  Младенцы (0-24м)
                </Button>
                <Button
                  type="button"
                  variant={sizeType === "kids_height" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSizeType("kids_height")}
                  data-testid="button-size-kids-height"
                >
                  Ростовки
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
          </>
          )}

          {catalogTemplate === "universal" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Характеристики товара
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Бренд</Label>
                  <Input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Название бренда"
                    data-testid="input-brand"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Единица измерения</Label>
                  <Select value={unitOfMeasure} onValueChange={setUnitOfMeasure}>
                    <SelectTrigger data-testid="select-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map((unit) => (
                        <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label>Характеристики</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSpecs([...specs, { name: "", value: "" }])}
                    data-testid="button-add-spec"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Добавить
                  </Button>
                </div>
                {specs.map((spec, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={spec.name}
                      onChange={(e) => {
                        const newSpecs = [...specs];
                        newSpecs[idx] = { ...spec, name: e.target.value };
                        setSpecs(newSpecs);
                      }}
                      placeholder="Название"
                      className="flex-1"
                      data-testid={`input-spec-name-${idx}`}
                    />
                    <Input
                      value={spec.value}
                      onChange={(e) => {
                        const newSpecs = [...specs];
                        newSpecs[idx] = { ...spec, value: e.target.value };
                        setSpecs(newSpecs);
                      }}
                      placeholder="Значение"
                      className="flex-1"
                      data-testid={`input-spec-value-${idx}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setSpecs(specs.filter((_, i) => i !== idx))}
                      data-testid={`button-remove-spec-${idx}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Цвета</Label>
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
                {selectedColors.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedColors.map((color) => (
                      <Badge key={color.hex} variant="secondary" className="flex items-center gap-2 pr-1">
                        <span className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: color.hex }} />
                        {color.name}
                        <button type="button" onClick={() => removeColor(color.hex)} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          )}

          {catalogTemplate === "food" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5" />
                Информация о блюде
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Состав / Ингредиенты</Label>
                <Textarea
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                  placeholder="Перечислите ингредиенты через запятую"
                  rows={3}
                  data-testid="input-ingredients"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Размер порции</Label>
                  <Input
                    value={portionSize}
                    onChange={(e) => setPortionSize(e.target.value)}
                    placeholder="Например: 250 мл"
                    data-testid="input-portion"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Вес</Label>
                  <Input
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="Например: 450 г"
                    data-testid="input-weight"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Время приготовления (мин)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={cookingTime ?? ""}
                    onChange={(e) => setCookingTime(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="0"
                    data-testid="input-cooking-time"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Калорийность (ккал)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={calories ?? ""}
                    onChange={(e) => setCalories(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="0"
                    data-testid="input-calories"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Аллергены</Label>
                <div className="flex flex-wrap gap-2">
                  {["Глютен", "Молоко", "Яйца", "Орехи", "Соя", "Рыба", "Морепродукты", "Кунжут"].map((allergen) => (
                    <Badge
                      key={allergen}
                      variant={allergens.includes(allergen) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        if (allergens.includes(allergen)) {
                          setAllergens(allergens.filter(a => a !== allergen));
                        } else {
                          setAllergens([...allergens, allergen]);
                        }
                      }}
                      data-testid={`badge-allergen-${allergen}`}
                    >
                      {allergen}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label>Модификаторы (добавки, соусы)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setModifiers([...modifiers, { name: "", options: [{ label: "", price: 0 }] }])}
                    data-testid="button-add-modifier"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Добавить
                  </Button>
                </div>
                {modifiers.map((mod, idx) => (
                  <div key={idx} className="p-3 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={mod.name}
                        onChange={(e) => {
                          const newMods = [...modifiers];
                          newMods[idx] = { ...mod, name: e.target.value };
                          setModifiers(newMods);
                        }}
                        placeholder="Название группы (напр. Соус)"
                        className="flex-1"
                        data-testid={`input-modifier-name-${idx}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setModifiers(modifiers.filter((_, i) => i !== idx))}
                        data-testid={`button-remove-modifier-${idx}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {mod.options.map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-2 ml-4">
                        <Input
                          value={opt.label}
                          onChange={(e) => {
                            const newMods = [...modifiers];
                            const newOpts = [...mod.options];
                            newOpts[optIdx] = { ...opt, label: e.target.value };
                            newMods[idx] = { ...mod, options: newOpts };
                            setModifiers(newMods);
                          }}
                          placeholder="Вариант (напр. Кетчуп)"
                          className="flex-1"
                          data-testid={`input-modifier-opt-label-${idx}-${optIdx}`}
                        />
                        <Input
                          type="number"
                          value={opt.price}
                          onChange={(e) => {
                            const newMods = [...modifiers];
                            const newOpts = [...mod.options];
                            newOpts[optIdx] = { ...opt, price: parseFloat(e.target.value) || 0 };
                            newMods[idx] = { ...mod, options: newOpts };
                            setModifiers(newMods);
                          }}
                          placeholder="Цена"
                          className="w-24"
                          data-testid={`input-modifier-opt-price-${idx}-${optIdx}`}
                        />
                        <span className="text-sm text-muted-foreground">₸</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newMods = [...modifiers];
                            const newOpts = mod.options.filter((_, i) => i !== optIdx);
                            newMods[idx] = { ...mod, options: newOpts };
                            setModifiers(newMods);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-4"
                      onClick={() => {
                        const newMods = [...modifiers];
                        newMods[idx] = { ...mod, options: [...mod.options, { label: "", price: 0 }] };
                        setModifiers(newMods);
                      }}
                      data-testid={`button-add-modifier-option-${idx}`}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Добавить вариант
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          )}

          {/* Tags Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Теги товара
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Выберите до 2 тегов для отображения на карточке товара
              </p>
              <div className="flex flex-wrap gap-2">
                {PRODUCT_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag.id);
                  const canSelect = isSelected || selectedTags.length < 2;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      disabled={!canSelect && !isSelected}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedTags(selectedTags.filter(t => t !== tag.id));
                        } else if (selectedTags.length < 2) {
                          setSelectedTags([...selectedTags, tag.id]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        isSelected
                          ? `${tag.color} text-white ring-2 ring-offset-2 ring-primary`
                          : canSelect
                            ? "bg-muted hover:bg-muted/80 text-foreground"
                            : "bg-muted/50 text-muted-foreground cursor-not-allowed"
                      }`}
                      data-testid={`button-tag-${tag.id}`}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
              {selectedTags.length > 0 && (
                <div className="pt-2">
                  <Label className="text-xs text-muted-foreground">Выбранные теги:</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedTags.map((tagId) => {
                      const tag = PRODUCT_TAGS.find(t => t.id === tagId);
                      if (!tag) return null;
                      return (
                        <Badge
                          key={tagId}
                          className={`${tag.color} text-white flex items-center gap-1 pr-1`}
                        >
                          {tag.label}
                          <button
                            type="button"
                            onClick={() => setSelectedTags(selectedTags.filter(t => t !== tagId))}
                            className="hover:text-white/80"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {isEdit && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Video className="h-5 w-5" />
                Видео товара
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Формат видео</Label>
                {getVideoFormats().length === 1 ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-video-format">
                    {getVideoFormats()[0].label}
                  </p>
                ) : (
                  <Select
                    value={videoFormat || getVideoFormats()[0].value}
                    onValueChange={(value) => setVideoFormat(value)}
                  >
                    <SelectTrigger data-testid="select-video-format">
                      <SelectValue placeholder="Выберите формат" />
                    </SelectTrigger>
                    <SelectContent>
                      {getVideoFormats().map((fmt) => (
                        <SelectItem key={fmt.value} value={fmt.value}>
                          {fmt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label htmlFor="autoGeneratePoster">Автогенерация обложки</Label>
                  <p className="text-sm text-muted-foreground">
                    Создать обложку из первого кадра видео
                  </p>
                </div>
                <Switch
                  id="autoGeneratePoster"
                  checked={autoGeneratePoster}
                  onCheckedChange={setAutoGeneratePoster}
                  data-testid="switch-auto-poster"
                />
              </div>

              {isUploadingVideo ? (
                <div className="flex flex-col items-center justify-center h-32 rounded-lg border border-dashed gap-2" data-testid="video-upload-progress">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{videoUploadProgress}</span>
                </div>
              ) : videoUrl ? (
                <div className="space-y-3">
                  <div className="relative rounded-lg overflow-hidden bg-muted">
                    <video
                      src={normalizeMediaUrl(videoUrl)}
                      className={`w-full ${
                        videoFormat === "9:16" ? "aspect-[9/16] max-h-[400px] mx-auto" :
                        videoFormat === "1:1" ? "aspect-square" :
                        "aspect-video"
                      } object-contain`}
                      controls
                      muted
                      playsInline
                      data-testid="video-preview"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={handleRemoveVideo}
                      data-testid="button-remove-video"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {videoPosterUrl && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Обложка видео</Label>
                      <div className="w-24 h-24 rounded-md overflow-hidden bg-muted">
                        <img
                          src={normalizeMediaUrl(videoPosterUrl)}
                          alt="Обложка видео"
                          className="w-full h-full object-cover"
                          data-testid="img-video-poster"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
                    onChange={handleVideoUpload}
                    className="hidden"
                    id="video-upload-input"
                    data-testid="input-video-upload"
                  />
                  <label htmlFor="video-upload-input">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => document.getElementById("video-upload-input")?.click()}
                      data-testid="button-upload-video"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Загрузить видео
                    </Button>
                  </label>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                MP4, MOV, WebM, AVI. Макс. {getMaxDuration()} сек, до 50MB
              </p>
            </CardContent>
          </Card>
          )}

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
            <Button type="submit" disabled={mutation.isPending || isCompressingImages || isUploadingVideo} data-testid="button-save">
              {mutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                  Сохранение...
                </span>
              ) : isCompressingImages ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                  Сжатие изображений...
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
              <InlineProductImages 
                ref={inlineImagesRef} 
                onCompressionChange={setIsCompressingImages}
              />
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
