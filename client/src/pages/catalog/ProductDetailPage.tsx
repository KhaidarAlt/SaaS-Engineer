import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
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
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PageLoader } from "@/components/LoadingSpinner";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import type { Product, Category, Promotion, Tenant } from "@shared/schema";

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

export default function ProductDetailPage() {
  const [, params] = useRoute("/c/:slug/product/:id");
  const slug = params?.slug || "";
  const productId = params?.id || "";
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [addedToCart, setAddedToCart] = useState(false);
  const { addItem, totalItems } = useCart();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<ProductDetailData>({
    queryKey: ["/api/catalog", slug, "product", productId],
    enabled: !!slug && !!productId,
  });

  const formatPrice = (value: number | string) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("ru-KZ").format(num) + " ₸";
  };

  const handleAddToCart = () => {
    if (!data?.product) return;
    
    for (let i = 0; i < quantity; i++) {
      addItem(data.product);
    }
    
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
              <Link href={`/c/${slug}`}>
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Назад в каталог
                </Button>
              </Link>
              <ThemeToggle />
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
            <Link href={`/c/${slug}`}>
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
  const allImages = [
    product.mainImageUrl,
    ...(product.galleryUrls || []),
  ].filter(Boolean) as string[];

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
            <Link href={`/c/${slug}`}>
              <h1 className="text-xl font-bold tracking-tight cursor-pointer">
                {data.tenant.name}
              </h1>
            </Link>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link href={`/c/${slug}/cart`}>
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
        <Link href={`/c/${slug}`}>
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
            <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
              <AnimatePresence mode="wait">
                {allImages.length > 0 ? (
                  <motion.img
                    key={currentImageIndex}
                    src={allImages[currentImageIndex]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  />
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
                {allImages.map((img, index) => (
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
                    <img
                      src={img}
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
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
                <span className="text-sm font-medium">Доступные размеры:</span>
                <div className="flex flex-wrap gap-2">
                  {((product as any).sizes as Array<string | {size: string; qty: number}>).map((sizeItem, idx) => {
                    // Handle both old string[] and new {size, qty}[] format
                    const isObject = typeof sizeItem === 'object' && sizeItem !== null;
                    const sizeLabel = isObject ? sizeItem.size : sizeItem;
                    const isAvailable = isObject ? (sizeItem.qty > 0 || product.alwaysInStock) : true;
                    return (
                      <Badge
                        key={isObject ? sizeItem.size : `${sizeItem}-${idx}`}
                        variant={isAvailable ? "outline" : "secondary"}
                        className={isAvailable ? "" : "opacity-50"}
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
                <span className="text-sm font-medium">Доступные цвета:</span>
                <div className="flex flex-wrap gap-2">
                  {((product as any).colors as {name: string; hex: string}[]).map((color) => (
                    <Badge
                      key={color.hex}
                      variant="outline"
                      className="gap-2"
                      data-testid={`color-${color.name}`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-border"
                        style={{ backgroundColor: color.hex }}
                      />
                      {color.name}
                    </Badge>
                  ))}
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
          </motion.div>
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
