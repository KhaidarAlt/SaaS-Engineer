import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  Heart,
  Sparkles,
  Ruler,
  ChevronUp,
  ChevronDown,
  X,
  Check,
  ArrowLeft,
  Package,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { resolveImageUrl } from "@/lib/imageUrl";
import type { Product } from "@shared/schema";

interface FashionCatalogProps {
  slug: string;
  basePath: string;
  tenant: any;
  products: any[];
  categories: any[];
}

const TAG_CONFIG: Record<string, { label: string; color: string }> = {
  hit: { label: "Хит", color: "bg-amber-500" },
  new: { label: "Новинка", color: "bg-blue-500" },
  best_price: { label: "Лучшая цена", color: "bg-green-500" },
  sale: { label: "Распродажа", color: "bg-red-500" },
};


function useFavorites(tenantSlug: string) {
  const storageKey = `favorites_${tenantSlug}`;
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const toggleFavorite = (productId: string) => {
    setFavorites((prev) => {
      const newFavorites = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      localStorage.setItem(storageKey, JSON.stringify(newFavorites));
      return newFavorites;
    });
  };
  const isFavorite = (productId: string) => favorites.includes(productId);
  return { favorites, toggleFavorite, isFavorite };
}

function formatPrice(value: number | string) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("ru-KZ").format(num) + " ₸";
}

function getViewerCount(productId: string): number {
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = (hash * 31 + productId.charCodeAt(i)) % 1000;
  }
  return 5 + (hash % 26);
}

const HEADER_HEIGHT = 56;
const CATEGORIES_HEIGHT = 48;
const TOTAL_TOP = HEADER_HEIGHT + CATEGORIES_HEIGHT;

export default function FashionCatalog({
  slug,
  basePath,
  tenant,
  products,
  categories,
}: FashionCatalogProps) {
  const { addItem, totalItems, setTenantSlug } = useCart();
  const { toast } = useToast();
  const { toggleFavorite, isFavorite } = useFavorites(slug);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sizeSheetOpen, setSizeSheetOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<any | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTenantSlug(slug);
  }, [slug, setTenantSlug]);

  const filteredProducts = useMemo(() => {
    let result = products.filter((p: any) => p.isActive);
    if (selectedCategory) {
      result = result.filter((p: any) => p.categoryId === selectedCategory);
    }
    return result;
  }, [products, selectedCategory]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const cardHeight = container.clientHeight;
    if (cardHeight === 0) return;
    const idx = Math.round(container.scrollTop / cardHeight);
    setCurrentIndex(idx);
  }, []);

  const openSizeSheet = useCallback((product: any) => {
    setActiveProduct(product);
    setSelectedSize(null);
    setSelectedColor(null);
    setSizeSheetOpen(true);
  }, []);

  const handleAddToCart = useCallback(() => {
    if (!activeProduct) return;
    if (activeProduct.sizes && activeProduct.sizes.length > 0 && !selectedSize) {
      toast({
        title: "Выберите размер",
        description: "Для добавления в корзину необходимо выбрать размер",
        variant: "destructive",
      });
      return;
    }

    const productToAdd = {
      ...activeProduct,
      price: activeProduct.computedPrice || activeProduct.price,
    };
    addItem(productToAdd);
    toast({
      title: "Добавлено в корзину",
      description: (
        <div className="flex items-center justify-between gap-4">
          <span className="truncate">
            {activeProduct.name}
            {selectedSize ? ` (${selectedSize})` : ""}
            {selectedColor ? ` — ${selectedColor}` : ""}
          </span>
          <a
            href={`${basePath}/cart`}
            className="shrink-0 text-primary font-medium hover:underline"
          >
            Оформить
          </a>
        </div>
      ),
    });
    setSizeSheetOpen(false);
    setActiveProduct(null);
    setSelectedSize(null);
    setSelectedColor(null);
  }, [activeProduct, selectedSize, selectedColor, addItem, toast, slug]);

  const handleQuickAddToCart = useCallback(
    (product: any) => {
      if (product.sizes && product.sizes.length > 0) {
        openSizeSheet(product);
        return;
      }
      const productToAdd = {
        ...product,
        price: product.computedPrice || product.price,
      };
      addItem(productToAdd);
      toast({
        title: "Добавлено в корзину",
        description: (
          <div className="flex items-center justify-between gap-4">
            <span className="truncate">{product.name}</span>
            <a
              href={`${basePath}/cart`}
              className="shrink-0 text-primary font-medium hover:underline"
            >
              Оформить
            </a>
          </div>
        ),
      });
    },
    [addItem, toast, slug, openSizeSheet],
  );

  const getAvailableColors = useCallback(() => {
    if (!activeProduct) return [];
    if (!selectedSize || !activeProduct.sizeColorStock) {
      return activeProduct.colors || [];
    }
    const availableHexes = activeProduct.sizeColorStock
      .filter((sc: any) => sc.size === selectedSize && sc.qty > 0)
      .map((sc: any) => sc.colorHex || sc.color);
    if (availableHexes.length === 0) return activeProduct.colors || [];
    return (activeProduct.colors || []).filter((c: any) =>
      availableHexes.includes(c.hex),
    );
  }, [activeProduct, selectedSize]);

  if (filteredProducts.length === 0) {
    return (
      <div className="max-w-md mx-auto bg-background min-h-screen">
        <header
          className="sticky top-0 z-50 flex items-center justify-between gap-2 px-4 bg-background/90 backdrop-blur-md border-b"
          style={{ height: HEADER_HEIGHT }}
        >
          <div className="flex items-center gap-2">
            {tenant?.logoUrl && (
              <img
                src={resolveImageUrl(tenant.logoUrl)}
                alt={tenant.name}
                className="h-8 w-8 rounded-full object-cover"
                data-testid="img-tenant-logo"
              />
            )}
            <span
              className="font-semibold text-foreground truncate"
              data-testid="text-tenant-name"
            >
              {tenant?.name || slug}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link href={`${basePath}/cart`}>
              <Button
                size="icon"
                variant="ghost"
                className="relative"
                data-testid="button-cart"
              >
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <span
                    className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center"
                    data-testid="badge-cart-count"
                  >
                    {totalItems}
                  </span>
                )}
              </Button>
            </Link>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground gap-4 p-8">
          <Package className="h-16 w-16" />
          <p className="text-lg font-medium">Товары не найдены</p>
          {selectedCategory && (
            <Button
              variant="outline"
              onClick={() => setSelectedCategory(null)}
              data-testid="button-clear-category"
            >
              Показать все товары
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-black min-h-screen relative">
      <header
        className="sticky top-0 z-50 flex items-center justify-between gap-2 px-4 bg-black/80 backdrop-blur-md"
        style={{ height: HEADER_HEIGHT }}
      >
        <div className="flex items-center gap-2">
          {tenant?.logoUrl && (
            <img
              src={resolveImageUrl(tenant.logoUrl)}
              alt={tenant.name}
              className="h-8 w-8 rounded-full object-cover border border-white/20"
              data-testid="img-tenant-logo"
            />
          )}
          <span
            className="font-semibold text-white truncate"
            data-testid="text-tenant-name"
          >
            {tenant?.name || slug}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link href={`${basePath}/cart`}>
            <Button
              size="icon"
              variant="ghost"
              className="relative text-white"
              data-testid="button-cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <span
                  className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center"
                  data-testid="badge-cart-count"
                >
                  {totalItems}
                </span>
              )}
            </Button>
          </Link>
        </div>
      </header>

      <div
        ref={categoryScrollRef}
        className="sticky z-40 flex items-center gap-2 px-4 overflow-x-auto scrollbar-hide bg-black/60 backdrop-blur-sm"
        style={{ top: HEADER_HEIGHT, height: CATEGORIES_HEIGHT }}
      >
        <button
          onClick={() => setSelectedCategory(null)}
          className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selectedCategory === null
              ? "bg-white text-black"
              : "bg-white/20 text-white/80"
          }`}
          data-testid="button-category-all"
        >
          Все
        </button>
        {categories.map((cat: any) => (
          <button
            key={cat.id}
            onClick={() =>
              setSelectedCategory(
                selectedCategory === cat.id ? null : cat.id,
              )
            }
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === cat.id
                ? "bg-white text-black"
                : "bg-white/20 text-white/80"
            }`}
            data-testid={`button-category-${cat.id}`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="overflow-y-auto snap-y snap-mandatory"
        style={{ height: `calc(100vh - ${TOTAL_TOP}px)` }}
      >
        {filteredProducts.map((product: any, index: number) => {
          const imageUrl = resolveImageUrl(product.mainImageUrl);
          const viewers = getViewerCount(product.id);
          const favorite = isFavorite(product.id);

          return (
            <div
              key={product.id}
              className="snap-start snap-always relative"
              style={{ height: `calc(100vh - ${TOTAL_TOP}px)` }}
              data-testid={`card-product-${product.id}`}
            >
              <div className="absolute inset-0 bg-black">
                {(product as any).videoUrl && (product as any).videoPrimary ? (
                  <video
                    src={resolveImageUrl((product as any).videoUrl)}
                    poster={resolveImageUrl((product as any).videoPosterUrl || product.mainImageUrl)}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-contain bg-black"
                    data-testid={`video-product-${product.id}`}
                  />
                ) : imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    loading={index < 2 ? "eager" : "lazy"}
                    data-testid={`img-product-${product.id}`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-neutral-900">
                    <Package className="h-20 w-20 text-neutral-700" />
                  </div>
                )}
              </div>

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

              {product.tags && product.tags.length > 0 && (
                <div className="absolute top-4 left-4 flex flex-wrap gap-1.5 z-10">
                  {product.tags.slice(0, 3).map((tag: string) => {
                    const config = TAG_CONFIG[tag];
                    if (!config) return null;
                    return (
                      <span
                        key={tag}
                        className={`${config.color} text-white text-xs font-semibold px-2.5 py-0.5 rounded-md`}
                        data-testid={`badge-tag-${tag}-${product.id}`}
                      >
                        {config.label}
                      </span>
                    );
                  })}
                  {product.hasDiscount && product.discountPercent && (
                    <span
                      className="bg-red-500 text-white text-xs font-semibold px-2.5 py-0.5 rounded-md"
                      data-testid={`badge-discount-${product.id}`}
                    >
                      -{Math.round(product.discountPercent)}%
                    </span>
                  )}
                </div>
              )}

              <div className="absolute right-3 bottom-1/3 flex flex-col items-center gap-4 z-10">
                <button
                  onClick={() => handleQuickAddToCart(product)}
                  className="relative flex flex-col items-center gap-1"
                  data-testid={`button-cart-${product.id}`}
                >
                  <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-white" />
                  </div>
                  {totalItems > 0 && (
                    <span
                      className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center"
                      data-testid="badge-cart-count-overlay"
                    >
                      {totalItems}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => toggleFavorite(product.id)}
                  className="flex flex-col items-center gap-1"
                  data-testid={`button-favorite-${product.id}`}
                >
                  <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                    <Heart
                      className={`h-5 w-5 ${favorite ? "text-red-500 fill-red-500" : "text-white"}`}
                    />
                  </div>
                </button>

                <button
                  onClick={() => {}}
                  className="flex flex-col items-center gap-1"
                  data-testid="button-ai-stylist"
                >
                  <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-white/80 text-[10px] font-medium">
                    Стилист
                  </span>
                </button>

                <button
                  onClick={() => openSizeSheet(product)}
                  className="flex flex-col items-center gap-1"
                  data-testid={`button-sizes-${product.id}`}
                >
                  <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                    <Ruler className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-white/80 text-[10px] font-medium">
                    Размеры
                  </span>
                </button>
              </div>

              <div className="absolute bottom-0 left-0 right-16 p-4 z-10">
                <Link href={`${basePath}/product/${product.id}`}>
                  <h2
                    className="text-white text-xl font-bold mb-2 line-clamp-2 cursor-pointer"
                    data-testid={`text-product-name-${product.id}`}
                  >
                    {product.name}
                  </h2>
                </Link>

                {product.brand && (
                  <span
                    className="inline-block bg-white/20 text-white text-xs px-2 py-0.5 rounded-md mb-2 backdrop-blur-sm"
                    data-testid={`badge-brand-${product.id}`}
                  >
                    {product.brand}
                  </span>
                )}

                <div className="flex items-center gap-3 mb-3">
                  {product.hasDiscount ? (
                    <>
                      <span
                        className="text-white text-2xl font-bold"
                        data-testid={`text-price-${product.id}`}
                      >
                        {formatPrice(product.computedPrice)}
                      </span>
                      <span
                        className="text-white/60 text-base line-through"
                        data-testid={`text-original-price-${product.id}`}
                      >
                        {formatPrice(product.originalPrice)}
                      </span>
                    </>
                  ) : (
                    <span
                      className="text-white text-2xl font-bold"
                      data-testid={`text-price-${product.id}`}
                    >
                      {formatPrice(product.computedPrice || product.price)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-white/50 text-xs">
                  <Flame className="h-3 w-3" />
                  <span data-testid={`text-viewers-${product.id}`}>
                    {viewers} человек смотрят
                  </span>
                </div>
              </div>

              {filteredProducts.length > 1 && (
                <div className="absolute right-3 top-4 z-10">
                  <span className="text-white/60 text-xs font-medium bg-black/30 px-2 py-1 rounded-full">
                    {index + 1} / {filteredProducts.length}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Sheet open={sizeSheetOpen} onOpenChange={setSizeSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-w-md mx-auto">
          <SheetHeader>
            <SheetTitle>
              {activeProduct?.name || "Выберите размер"}
            </SheetTitle>
            <SheetDescription>
              Выберите размер и цвет для добавления в корзину
            </SheetDescription>
          </SheetHeader>

          {activeProduct && (
            <div className="mt-4 space-y-6">
              <div className="flex items-center gap-3">
                {activeProduct.mainImageUrl && (
                  <img
                    src={resolveImageUrl(activeProduct.mainImageUrl)}
                    alt={activeProduct.name}
                    className="w-16 h-16 rounded-md object-cover"
                  />
                )}
                <div>
                  <p className="font-semibold text-foreground">
                    {activeProduct.name}
                  </p>
                  <div className="flex items-center gap-2">
                    {activeProduct.hasDiscount ? (
                      <>
                        <span className="text-lg font-bold text-red-500">
                          {formatPrice(activeProduct.computedPrice)}
                        </span>
                        <span className="text-sm text-muted-foreground line-through">
                          {formatPrice(activeProduct.originalPrice)}
                        </span>
                      </>
                    ) : (
                      <span className="text-lg font-bold">
                        {formatPrice(
                          activeProduct.computedPrice || activeProduct.price,
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {activeProduct.sizes && activeProduct.sizes.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">
                    Размер
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {activeProduct.sizes.map(
                      (s: { size: string; qty: number }) => {
                        const isAvailable =
                          activeProduct.alwaysInStock || s.qty > 0;
                        const isSelected = selectedSize === s.size;
                        return (
                          <button
                            key={s.size}
                            disabled={!isAvailable}
                            onClick={() => {
                              setSelectedSize(
                                isSelected ? null : s.size,
                              );
                              setSelectedColor(null);
                            }}
                            className={`min-w-[48px] px-3 py-2 rounded-md text-sm font-medium transition-colors border ${
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary"
                                : isAvailable
                                  ? "bg-secondary text-secondary-foreground border-transparent"
                                  : "bg-muted text-muted-foreground/40 border-transparent cursor-not-allowed line-through"
                            }`}
                            data-testid={`button-size-${s.size}`}
                          >
                            {s.size}
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
              )}

              {activeProduct.colors && activeProduct.colors.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">
                    Цвет
                    {selectedColor && (
                      <span className="ml-2 text-muted-foreground font-normal">
                        — {selectedColor}
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {getAvailableColors().map(
                      (c: { name: string; hex: string }) => {
                        const isSelected = selectedColor === c.name;
                        return (
                          <button
                            key={c.hex}
                            onClick={() =>
                              setSelectedColor(
                                isSelected ? null : c.name,
                              )
                            }
                            className={`w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center ${
                              isSelected
                                ? "border-primary scale-110"
                                : "border-transparent"
                            }`}
                            title={c.name}
                            data-testid={`button-color-${c.name}`}
                          >
                            <span
                              className="w-7 h-7 rounded-full block border border-black/10"
                              style={{ backgroundColor: c.hex }}
                            />
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                size="lg"
                onClick={handleAddToCart}
                disabled={
                  activeProduct.sizes &&
                  activeProduct.sizes.length > 0 &&
                  !selectedSize
                }
                data-testid="button-add-to-cart"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                В корзину
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
