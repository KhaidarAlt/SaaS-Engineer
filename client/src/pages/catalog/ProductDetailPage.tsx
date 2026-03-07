import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useCatalogSlug } from "@/hooks/useCatalogSlug";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  ArrowLeft,
  Package,
  Check,
  Tag,
  Minus,
  Plus,
  ChevronLeft,
  ChevronRight,
  Bot,
  Send,
  Loader2,
  X,
  Heart,
  Eye,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PageLoader } from "@/components/LoadingSpinner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCart } from "@/contexts/CartContext";
import { CATALOG_TEMPLATES, type CatalogTemplateType } from "@shared/templateRegistry";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { trackEvent } from "@/lib/analytics";
import { apiRequest } from "@/lib/queryClient";
import { resolveImageUrl } from "@/lib/imageUrl";
import type { Product, Category, Promotion, Tenant } from "@shared/schema";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ProductWithPrice extends Product {
  computedPrice: string;
  originalPrice: string;
  discountPercent: number | null;
  discountType: string | null;
  hasDiscount: boolean;
}

interface ProductDetailData {
  product: ProductWithPrice;
  category: Category | null;
  promotion: Promotion | null;
  tenant: {
    id: string;
    name: string;
    slug: string;
    contactPhone: string | null;
  };
}

interface CatalogData {
  tenant: Tenant;
  products: ProductWithPrice[];
  categories: Category[];
  promotions: Promotion[];
}

export default function ProductDetailPage() {
  const [, routeParams] = useRoute("/c/:slug/product/:id");
  const [, rootRouteParams] = useRoute("/product/:id");
  const { slug, basePath } = useCatalogSlug("/c/:slug/product/:id");
  const productId = routeParams?.id || rootRouteParams?.id || "";
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [addedToCart, setAddedToCart] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const { addItem, totalItems } = useCart();
  const { toast } = useToast();

  const aiChatMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", `/api/catalog/${slug}/product/${productId}/ai-chat`, { message });
      return res.json() as Promise<{ response: string }>;
    },
    onSuccess: (data) => {
      setChatMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "assistant", content: data.response },
      ]);
    },
    onError: () => {
      setChatMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "assistant", content: "Извините, произошла ошибка. Попробуйте ещё раз." },
      ]);
    },
  });

  const handleSendMessage = () => {
    const message = chatInput.trim();
    if (!message || aiChatMutation.isPending) return;
    
    setChatMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", content: message },
    ]);
    setChatInput("");
    aiChatMutation.mutate(message);
  };

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const { data, isLoading, error } = useQuery<ProductDetailData>({
    queryKey: ["/api/catalog", slug, "product", productId],
    enabled: !!slug && !!productId,
  });

  const { data: catalogData } = useQuery<CatalogData>({
    queryKey: ["/api/catalog", slug],
    enabled: !!slug,
  });

  const templateType = ((catalogData?.tenant as any)?.catalogTemplate || "universal") as CatalogTemplateType;
  const aiTemplate = CATALOG_TEMPLATES[templateType] || CATALOG_TEMPLATES.universal;
  const aiRoleName = aiTemplate.aiRole.roleName;

  const trackedRef = useRef(false);
  useEffect(() => {
    if (slug && productId && !trackedRef.current) {
      trackedRef.current = true;
      trackEvent({ 
        tenantSlug: slug, 
        eventType: 'product_view',
        productId,
        objectType: 'product',
        objectId: productId,
      });
    }
  }, [slug, productId]);

  const isMobile = useIsMobile();

  const formatPrice = (value: number | string) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("ru-KZ").format(num) + " ₸";
  };

  const getRelatedProducts = () => {
    if (!data?.product || !catalogData?.products) return [];
    
    const relatedProducts = catalogData.products.filter(
      (p) => 
        p.categoryId === data.product.categoryId && 
        p.id !== data.product.id &&
        p.isActive
    );
    
    return relatedProducts.slice(0, 4);
  };

  const CompactProductCard = ({ 
    product, 
    onAddToCart 
  }: { 
    product: ProductWithPrice;
    onAddToCart: (product: ProductWithPrice) => void;
  }) => {
    const isInStock = product.alwaysInStock || product.stockQty > 0;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex-shrink-0 w-40 md:w-48"
      >
        <Card className="overflow-hidden h-full hover-elevate flex flex-col">
          <Link href={`${basePath}/product/${product.id}`}>
            <div className="aspect-square relative overflow-hidden bg-muted cursor-pointer">
              {product.mainImageUrl ? (
                <img
                  src={resolveImageUrl(product.mainImageUrl)}
                  alt={product.name}
                  className="w-full h-full object-contain p-1"
                  loading="lazy"
                  data-testid={`img-cross-sell-${product.id}`}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-12 w-12 text-muted-foreground/30" />
                </div>
              )}
              {product.hasDiscount && product.discountPercent && (
                <div className="absolute top-2 left-2">
                  <Badge className="bg-red-500 text-white">
                    -{Math.round(product.discountPercent)}%
                  </Badge>
                </div>
              )}
            </div>
          </Link>
          <CardContent className="p-3 flex flex-col flex-1">
            <Link href={`${basePath}/product/${product.id}`}>
              <h3 className="font-medium line-clamp-2 text-sm cursor-pointer text-foreground hover:text-primary mb-2" data-testid={`heading-cross-sell-${product.id}`}>
                {product.name}
              </h3>
            </Link>
            <div className="mt-auto">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex flex-col">
                  {product.hasDiscount ? (
                    <>
                      <p className="text-sm font-bold text-red-500">
                        {formatPrice(product.computedPrice)}
                      </p>
                      <p className="text-xs text-muted-foreground line-through">
                        {formatPrice(product.originalPrice)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-bold">{formatPrice(product.computedPrice)}</p>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                disabled={!isInStock}
                onClick={() => onAddToCart(product)}
                className="w-full"
                data-testid={`button-cross-sell-add-cart-${product.id}`}
              >
                <ShoppingCart className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const handleCrossSellAddToCart = (product: ProductWithPrice) => {
    addItem(product);
    toast({
      title: "Добавлено в корзину",
      description: `${product.name}`,
    });
    
    trackEvent({
      tenantSlug: slug,
      eventType: 'add_to_cart',
      productId: product.id,
      metadata: { price: product.computedPrice },
    });
  };

  const handleAddToCart = () => {
    if (!data?.product) return;
    
    for (let i = 0; i < quantity; i++) {
      addItem(data.product);
    }
    
    trackEvent({
      tenantSlug: slug,
      eventType: 'add_to_cart',
      productId: data.product.id,
      metadata: { quantity, price: data.product.computedPrice },
    });
    
    setAddedToCart(true);
    toast({
      title: "Добавлено в корзину",
      description: `${data.product.name} × ${quantity}`,
    });
    
    setTimeout(() => setAddedToCart(false), 2000);
  };

  if (isLoading) {
    return <PageLoader />;
  }

  if (error || !data?.product) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 backdrop-blur-md bg-background/95 border-b border-border">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href={basePath || "/"}>
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Назад в каталог
                </Button>
              </Link>
              <ThemeToggle variant="catalog" />
            </div>
          </div>
        </header>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Package className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Товар не найден</h1>
            <p className="text-muted-foreground mb-4">
              Товар был удалён или скрыт владельцем магазина
            </p>
            <Link href={basePath || "/"}>
              <Button data-testid="button-back-catalog">
                Вернуться в каталог
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const product = data.product;
  const videoUrl = (product as any).videoUrl ? resolveImageUrl((product as any).videoUrl) : null;
  const videoPosterUrl = (product as any).videoPosterUrl ? resolveImageUrl((product as any).videoPosterUrl) : null;
  const isVideoPrimary = (product as any).videoPrimary;
  const allMedia: string[] = [
    ...(videoUrl && isVideoPrimary ? [videoUrl] : []),
    ...(product.mainImageUrl ? [resolveImageUrl(product.mainImageUrl)] : []),
    ...((product.galleryUrls || []).map((u: string) => resolveImageUrl(u))),
    ...(videoUrl && !isVideoPrimary ? [videoUrl] : []),
  ].filter(Boolean) as string[];
  const allImages = allMedia;

  const nextImage = () => {
    if (allImages.length > 1) {
      setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
    }
  };

  const prevImage = () => {
    if (allImages.length > 1) {
      setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
    }
  };

  const isInStock = product.alwaysInStock || product.stockQty > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/95 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href={basePath || "/"}>
              <h1 className="text-xl font-bold tracking-tight cursor-pointer">
                {data.tenant.name}
              </h1>
            </Link>
            <div className="flex items-center gap-3">
              <ThemeToggle variant="catalog" />
              <Link href={`${basePath}/cart`}>
                <Button variant="outline" className="relative" data-testid="button-cart">
                  <ShoppingCart className="h-5 w-5" />
                  {totalItems > 0 && (
                    <motion.span
                      key={totalItems}
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center"
                    >
                      {totalItems}
                    </motion.span>
                  )}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        <Link href={basePath || "/"}>
          <Button variant="ghost" size="sm" className="gap-2 mb-6">
            <ArrowLeft className="h-4 w-4" />
            Вернуться в каталог
          </Button>
        </Link>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <div className="relative aspect-[4/5] sm:aspect-square rounded-xl overflow-hidden bg-muted max-h-[65vh]">
              <AnimatePresence mode="wait">
                {allImages.length > 0 ? (
                  videoUrl && allImages[currentImageIndex] === videoUrl ? (
                    <motion.div
                      key="video"
                      className="w-full h-full"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <video
                        src={videoUrl}
                        poster={videoPosterUrl || resolveImageUrl(product.mainImageUrl)}
                        controls
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-contain"
                        data-testid={`video-product-${product.id}`}
                      />
                    </motion.div>
                  ) : (
                    <motion.img
                      key={currentImageIndex}
                      src={allImages[currentImageIndex]}
                      alt={product.name}
                      className="w-full h-full object-contain p-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-24 w-24 text-muted-foreground/30" />
                  </div>
                )}
              </AnimatePresence>

              {allImages.length > 1 && (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full"
                    onClick={prevImage}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full"
                    onClick={nextImage}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              )}

              <div className="absolute top-3 left-3 flex flex-col gap-2">
                {product.hasDiscount && product.discountPercent && (
                  <Badge className="bg-red-500 text-white">
                    -{Math.round(product.discountPercent)}%
                  </Badge>
                )}
                {data.promotion && (
                  <Badge variant="secondary" className="gap-1">
                    <Tag className="h-3 w-3" />
                    Акция
                  </Badge>
                )}
                {!isInStock && (
                  <Badge variant="destructive">Нет в наличии</Badge>
                )}
              </div>
            </div>

            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {allImages.map((img, index) => {
                  const isVideo = videoUrl && img === videoUrl;
                  return (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                        index === currentImageIndex
                          ? "border-primary"
                          : "border-border"
                      }`}
                      data-testid={`button-thumbnail-${index}`}
                    >
                      {isVideo ? (
                        <video
                          src={img}
                          poster={videoPosterUrl || resolveImageUrl(product.mainImageUrl)}
                          muted
                          playsInline
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <img
                          src={img}
                          alt={`${product.name} ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {data.category && (
              <p className="text-sm text-muted-foreground">{data.category.name}</p>
            )}

            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-primary">
                {formatPrice(product.computedPrice)}
              </span>
              {product.hasDiscount && (
                <span className="text-xl text-muted-foreground line-through">
                  {formatPrice(product.originalPrice)}
                </span>
              )}
            </div>

            {data.promotion && (
              <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Tag className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{data.promotion.title}</span>
                  </div>
                  {data.promotion.description && (
                    <p className="text-sm text-muted-foreground">
                      {data.promotion.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {product.description && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {product.description}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Артикул:</span>
              <span className="font-medium">{product.sku}</span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                  isInStock ? "text-green-600" : "text-red-500"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isInStock ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                {isInStock
                  ? product.alwaysInStock
                    ? "Всегда в наличии"
                    : `В наличии: ${product.stockQty} шт.`
                  : "Нет в наличии"}
              </span>
            </div>

            {(product as any).gender && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Для кого:</span>
                <Badge variant="secondary">
                  {{
                    male: "Мужской",
                    female: "Женский",
                    kids: "Детский",
                  }[(product as any).gender as string] || (product as any).gender}
                </Badge>
              </div>
            )}

            {((product as any).sizes?.length > 0) && (
              <div className="space-y-3">
                <span className="text-sm font-medium">Выберите размер:</span>
                <div className="flex flex-wrap gap-2">
                  {((product as any).sizes as Array<string | {size: string; qty: number}>).map((sizeItem, idx) => {
                    const isObject = typeof sizeItem === 'object' && sizeItem !== null;
                    const sizeLabel = isObject ? sizeItem.size : sizeItem;
                    const sizeColorStock = (product as any).sizeColorStock as {size: string; colorHex: string; qty: number}[] | undefined;
                    const colors = (product as any).colors as {name: string; hex: string}[] | undefined;
                    
                    let isAvailable = true;
                    if (sizeColorStock && sizeColorStock.length > 0 && colors && colors.length > 0) {
                      if (selectedColor) {
                        const stockItem = sizeColorStock.find(s => s.size === sizeLabel && s.colorHex === selectedColor);
                        isAvailable = (stockItem?.qty ?? 0) > 0 || product.alwaysInStock;
                      } else {
                        isAvailable = sizeColorStock.some(s => s.size === sizeLabel && s.qty > 0) || product.alwaysInStock;
                      }
                    } else if (isObject) {
                      isAvailable = sizeItem.qty > 0 || product.alwaysInStock;
                    }
                    
                    const isSelected = selectedSize === sizeLabel;
                    return (
                      <Badge
                        key={isObject ? sizeItem.size : `${sizeItem}-${idx}`}
                        variant={isSelected ? "default" : isAvailable ? "outline" : "secondary"}
                        className={`cursor-pointer ${!isAvailable ? "opacity-50" : ""}`}
                        onClick={() => isAvailable && setSelectedSize(isSelected ? null : sizeLabel)}
                        data-testid={`size-${sizeLabel}`}
                      >
                        {sizeLabel}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {((product as any).colors?.length > 0) && (
              <div className="space-y-3">
                <span className="text-sm font-medium">Выберите цвет:</span>
                <div className="flex flex-wrap gap-2">
                  {((product as any).colors as {name: string; hex: string}[]).map((color) => {
                    const sizeColorStock = (product as any).sizeColorStock as {size: string; colorHex: string; qty: number}[] | undefined;
                    const sizes = (product as any).sizes as Array<string | {size: string; qty: number}> | undefined;
                    
                    let isAvailable = true;
                    if (sizeColorStock && sizeColorStock.length > 0 && sizes && sizes.length > 0) {
                      if (selectedSize) {
                        const stockItem = sizeColorStock.find(s => s.size === selectedSize && s.colorHex === color.hex);
                        isAvailable = (stockItem?.qty ?? 0) > 0 || product.alwaysInStock;
                      } else {
                        isAvailable = sizeColorStock.some(s => s.colorHex === color.hex && s.qty > 0) || product.alwaysInStock;
                      }
                    }
                    
                    const isSelected = selectedColor === color.hex;
                    return (
                      <Badge
                        key={color.hex}
                        variant={isSelected ? "default" : isAvailable ? "outline" : "secondary"}
                        className={`gap-2 cursor-pointer ${!isAvailable ? "opacity-50" : ""}`}
                        onClick={() => isAvailable && setSelectedColor(isSelected ? null : color.hex)}
                        data-testid={`color-${color.name}`}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-border"
                          style={{ backgroundColor: color.hex }}
                        />
                        {color.name}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 pt-4">
              <div className="flex items-center border rounded-lg">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity((q) => q + 1)}
                  disabled={!isInStock || (!product.alwaysInStock && quantity >= (product.stockQty || 0))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <Button
                size="lg"
                className="flex-1 gap-2"
                disabled={!isInStock}
                onClick={handleAddToCart}
                data-testid="button-add-to-cart"
              >
                <AnimatePresence mode="wait">
                  {addedToCart ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="flex items-center gap-2"
                    >
                      <Check className="h-5 w-5" />
                      Добавлено
                    </motion.div>
                  ) : (
                    <motion.div
                      key="cart"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="flex items-center gap-2"
                    >
                      <ShoppingCart className="h-5 w-5" />
                      В корзину
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
            </div>

            {(catalogData?.tenant as any)?.showAiConsultant !== false && (
            <Sheet open={aiChatOpen} onOpenChange={setAiChatOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  data-testid="button-ai-consultant"
                >
                  <Bot className="h-5 w-5" />
                  Спросить {aiRoleName}
                </Button>
              </SheetTrigger>
              <SheetContent className="flex flex-col w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    {aiRoleName}
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 flex flex-col min-h-0">
                  <ScrollArea className="flex-1 pr-4" ref={chatScrollRef as any}>
                    <div className="space-y-4 py-4">
                      {chatMessages.length === 0 && (
                        <div className="text-center text-muted-foreground py-8">
                          <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">
                            Привет! Я {aiRoleName}.
                            <br />
                            Задайте вопрос о товаре "{product.name}"
                          </p>
                        </div>
                      )}
                      {chatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-lg px-4 py-2 ${
                              msg.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                            data-testid={`chat-message-${msg.role}`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      ))}
                      {aiChatMutation.isPending && (
                        <div className="flex justify-start">
                          <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm text-muted-foreground">AI думает...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                  <div className="flex gap-2 pt-4 border-t">
                    <Input
                      placeholder="Задайте вопрос о товаре..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                      disabled={aiChatMutation.isPending}
                      data-testid="input-ai-chat"
                    />
                    <Button
                      size="icon"
                      onClick={handleSendMessage}
                      disabled={!chatInput.trim() || aiChatMutation.isPending}
                      data-testid="button-send-ai-message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            )}
          </motion.div>

          {(catalogData?.tenant as any)?.showCrossSell !== false && getRelatedProducts().length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="col-span-full"
              data-testid="section-cross-sell"
            >
              <div className="mt-16 pt-8 border-t border-border">
                <h2 className="text-2xl font-bold mb-6" data-testid="heading-cross-sell">
                  С этим товаром берут
                </h2>
                
                {isMobile ? (
                  <ScrollArea className="pb-4">
                    <div className="flex gap-4">
                      {getRelatedProducts().map((product) => (
                        <CompactProductCard
                          key={product.id}
                          product={product}
                          onAddToCart={handleCrossSellAddToCart}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {getRelatedProducts().map((product) => (
                      <CompactProductCard
                        key={product.id}
                        product={product}
                        onAddToCart={handleCrossSellAddToCart}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </main>

      <footer className="border-t border-border py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 text-center">
          <p className="text-sm text-muted-foreground">
            {data.tenant.name} © {new Date().getFullYear()}
          </p>
          {data.tenant.contactPhone && (
            <p className="text-sm text-muted-foreground mt-1">
              Тел: {data.tenant.contactPhone}
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
