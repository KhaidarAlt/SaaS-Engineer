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
  LayoutGrid,
  Rows3,
  Share2,
  Star,
  Eye,
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

function getRating(productId: string): string {
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = (hash * 17 + productId.charCodeAt(i)) % 100;
  }
  return (4.3 + (hash % 8) * 0.1).toFixed(1);
}

const HEADER_HEIGHT = 56;
const CATEGORIES_HEIGHT = 48;
const TOTAL_TOP = HEADER_HEIGHT + CATEGORIES_HEIGHT;

function GridProductCard({
  product,
  basePath,
  isFavorite,
  onToggleFavorite,
  onQuickAddToCart,
  onOpenSizes,
}: {
  product: any;
  basePath: string;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onQuickAddToCart: (product: any) => void;
  onOpenSizes: (product: any) => void;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);
  const imageUrl = resolveImageUrl(product.mainImageUrl);
  const viewers = getViewerCount(product.id);
  const rating = getRating(product.id);

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite(product.id);
    if (!isFavorite) {
      setHeartAnim(true);
      setTimeout(() => setHeartAnim(false), 600);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          url: `${window.location.origin}${basePath}/product/${product.id}`,
        });
      } else {
        await navigator.clipboard.writeText(
          `${window.location.origin}${basePath}/product/${product.id}`
        );
      }
    } catch {}
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      data-testid={`card-product-${product.id}`}
    >
      <div className="rounded-2xl overflow-hidden bg-neutral-900/80 backdrop-blur-md border border-white/[0.08] shadow-lg shadow-black/20">
        <Link href={`${basePath}/product/${product.id}`}>
          <div className="aspect-[3/4] relative overflow-hidden cursor-pointer group">
            {(product as any).videoUrl && (product as any).videoPrimary ? (
              <video
                src={resolveImageUrl((product as any).videoUrl)}
                poster={resolveImageUrl((product as any).videoPosterUrl || product.mainImageUrl)}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                data-testid={`video-product-${product.id}`}
              />
            ) : imageUrl ? (
              <img
                src={imageUrl}
                alt={product.name}
                className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                loading="lazy"
                onLoad={() => setImgLoaded(true)}
                data-testid={`img-product-${product.id}`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                <Package className="h-12 w-12 text-neutral-600" />
              </div>
            )}

            {!imgLoaded && !((product as any).videoUrl && (product as any).videoPrimary) && imageUrl && (
              <div className="absolute inset-0 bg-neutral-800 animate-pulse" />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

            <button
              onClick={handleFavorite}
              className="absolute top-3 right-3 z-10"
              data-testid={`button-favorite-${product.id}`}
            >
              <Heart
                className={`h-6 w-6 drop-shadow-lg transition-all duration-300 ${
                  isFavorite
                    ? "text-red-500 fill-red-500 scale-110"
                    : "text-white/90"
                } ${heartAnim ? "animate-[heartBeat_0.6s_ease-in-out]" : ""}`}
              />
            </button>

            {product.tags && product.tags.length > 0 && (
              <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
                {product.tags.slice(0, 2).map((tag: string) => {
                  const config = TAG_CONFIG[tag];
                  if (!config) return null;
                  return (
                    <span
                      key={tag}
                      className={`${config.color} text-white text-[10px] font-bold px-2 py-0.5 rounded-md`}
                      data-testid={`badge-tag-${tag}-${product.id}`}
                    >
                      {config.label}
                    </span>
                  );
                })}
              </div>
            )}

            {product.hasDiscount && product.discountPercent && (
              <div className="absolute bottom-3 left-3 z-10">
                <span
                  className="bg-gradient-to-r from-rose-500 to-pink-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg"
                  data-testid={`badge-discount-${product.id}`}
                >
                  -{Math.round(product.discountPercent)}%
                </span>
              </div>
            )}
          </div>
        </Link>

        <div className="p-3 space-y-2">
          {product.colors && product.colors.length > 0 && (
            <div className="flex items-center gap-1.5">
              {product.colors.slice(0, 5).map((c: { name: string; hex: string }) => (
                <span
                  key={c.hex}
                  className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                />
              ))}
              {product.colors.length > 5 && (
                <span className="text-[10px] text-white/40">+{product.colors.length - 5}</span>
              )}
            </div>
          )}

          <Link href={`${basePath}/product/${product.id}`}>
            <h3
              className="text-white font-semibold text-sm line-clamp-2 cursor-pointer leading-tight"
              data-testid={`text-product-name-${product.id}`}
            >
              {product.name}
            </h3>
          </Link>

          {product.brand && (
            <span className="text-white/40 text-xs" data-testid={`badge-brand-${product.id}`}>
              {product.brand}
            </span>
          )}

          <div className="flex items-baseline gap-2">
            {product.hasDiscount ? (
              <>
                <span
                  className="text-white font-bold text-base bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent"
                  data-testid={`text-price-${product.id}`}
                >
                  {formatPrice(product.computedPrice)}
                </span>
                <span
                  className="text-white/30 text-xs line-through"
                  data-testid={`text-original-price-${product.id}`}
                >
                  {formatPrice(product.originalPrice)}
                </span>
              </>
            ) : (
              <span
                className="text-white font-bold text-base"
                data-testid={`text-price-${product.id}`}
              >
                {formatPrice(product.computedPrice || product.price)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-white/40">
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {rating}
            </span>
            <span className="flex items-center gap-1" data-testid={`text-viewers-${product.id}`}>
              <Flame className="h-3 w-3" />
              {viewers} смотрят
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
            <div className="flex items-center gap-1">
              <button
                onClick={handleFavorite}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                data-testid={`button-favorite-grid-${product.id}`}
              >
                <Heart
                  className={`h-4 w-4 transition-colors ${
                    isFavorite ? "text-red-500 fill-red-500" : "text-white/60"
                  }`}
                />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onQuickAddToCart(product);
                }}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                data-testid={`button-cart-${product.id}`}
              >
                <ShoppingCart className="h-4 w-4 text-white/60" />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                data-testid={`button-stylist-grid-${product.id}`}
              >
                <Sparkles className="h-4 w-4 text-white/60" />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpenSizes(product);
                }}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                data-testid={`button-sizes-grid-${product.id}`}
              >
                <Ruler className="h-4 w-4 text-white/60" />
              </button>
            </div>
            <button
              onClick={handleShare}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
              data-testid={`button-share-${product.id}`}
            >
              <Share2 className="h-4 w-4 text-white/60" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

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
  const [viewMode, setViewMode] = useState<'feed' | 'grid'>(() => {
    try {
      const saved = localStorage.getItem(`fashion_view_${slug}`);
      return saved === 'grid' ? 'grid' : 'feed';
    } catch { return 'feed'; }
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTenantSlug(slug);
  }, [slug, setTenantSlug]);

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => {
      const next = prev === 'feed' ? 'grid' : 'feed';
      try { localStorage.setItem(`fashion_view_${slug}`, next); } catch {}
      return next;
    });
  }, [slug]);

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

  const headerContent = (
    <>
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
          <button
            onClick={toggleViewMode}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            data-testid="button-toggle-view"
            title={viewMode === 'feed' ? 'Сетка' : 'Лента'}
          >
            {viewMode === 'feed' ? (
              <LayoutGrid className="h-5 w-5 text-white/80" />
            ) : (
              <Rows3 className="h-5 w-5 text-white/80" />
            )}
          </button>
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
                  className="absolute -top-1 -right-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center"
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
          className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
            selectedCategory === null
              ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-pink-500/25"
              : "bg-white/10 text-white/70 hover:bg-white/20"
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
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              selectedCategory === cat.id
                ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-pink-500/25"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
            data-testid={`button-category-${cat.id}`}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </>
  );

  const sizeSheet = (
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
  );

  if (viewMode === 'grid') {
    return (
      <div className="max-w-4xl mx-auto bg-black min-h-screen relative">
        <style>{`
          @keyframes heartBeat {
            0% { transform: scale(1); }
            15% { transform: scale(1.3); }
            30% { transform: scale(0.95); }
            45% { transform: scale(1.15); }
            60% { transform: scale(1); }
          }
        `}</style>

        {headerContent}

        <div className="px-2 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {filteredProducts.map((product: any) => (
              <GridProductCard
                key={product.id}
                product={product}
                basePath={basePath}
                isFavorite={isFavorite(product.id)}
                onToggleFavorite={toggleFavorite}
                onQuickAddToCart={handleQuickAddToCart}
                onOpenSizes={openSizeSheet}
              />
            ))}
          </div>
        </div>

        {sizeSheet}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-black min-h-screen relative">
      {headerContent}

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
                      className="bg-gradient-to-r from-rose-500 to-pink-600 text-white text-xs font-semibold px-2.5 py-0.5 rounded-md"
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
                      className="absolute -top-1 -right-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center"
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
                      className={`h-5 w-5 transition-all ${favorite ? "text-red-500 fill-red-500 scale-110" : "text-white"}`}
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

      {sizeSheet}
    </div>
  );
}
