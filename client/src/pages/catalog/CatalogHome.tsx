import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useCatalogSlug } from "@/hooks/useCatalogSlug";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ShoppingCart,
  Filter,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Tag,
  Sparkles,
  Package,
  Percent,
  Phone,
  MapPin,
  Clock,
  MessageCircle,
  Heart,
  Eye,
  ExternalLink,
  LayoutGrid,
  List as ListIcon,
  Table2,
  ArrowUpDown,
  Grid2x2,
  Square,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CardSkeleton } from "@/components/LoadingSpinner";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { trackEvent, updateCartSession } from "@/lib/analytics";
import { resolveImageUrl } from "@/lib/imageUrl";
import type { Tenant, Product, Category, Promotion, PromoBlock } from "@shared/schema";

interface ProductWithPrice extends Product {
  computedPrice: string;
  originalPrice: string;
  discountPercent: number | null;
  discountType: string | null;
  hasDiscount: boolean;
  promotionName?: string;
  discountName?: string;
}

const TAG_CONFIG: Record<string, { label: string; color: string }> = {
  hit: { label: "Хит", color: "bg-amber-500" },
  new: { label: "Новинка", color: "bg-blue-500" },
  best_price: { label: "Лучшая цена", color: "bg-green-500" },
  sale: { label: "Распродажа", color: "bg-red-500" },
  delivery_today: { label: "Доставка сегодня", color: "bg-purple-500" },
  in_stock: { label: "В наличии", color: "bg-teal-500" },
  low_stock: { label: "Заканчивается", color: "bg-orange-500" },
};


interface CatalogData {
  tenant: Tenant;
  products: ProductWithPrice[];
  categories: Category[];
  promotions: Promotion[];
}

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

function ProductCard({ 
  product, 
  tenantSlug,
  basePath,
  isFavorite, 
  onToggleFavorite,
  onQuickView,
  showFavorites,
  showQuickView,
  compact = false,
}: { 
  product: ProductWithPrice; 
  tenantSlug: string;
  basePath: string;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onQuickView: (product: ProductWithPrice) => void;
  showFavorites: boolean;
  showQuickView: boolean;
  compact?: boolean;
}) {
  const { addItem } = useCart();
  const { toast } = useToast();
  
  const isInStock = product.alwaysInStock || product.inStock || product.stockQty > 0;

  const formatPrice = (value: number | string) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("ru-KZ").format(num) + " ₸";
  };

  const handleAddToCart = () => {
    addItem(product);
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
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden h-full hover-elevate">
        <Link href={`${basePath}/product/${product.id}`}>
          <div
            className="aspect-square relative overflow-hidden bg-white dark:bg-neutral-900 cursor-pointer"
          >
            {(product as any).videoUrl && (product as any).videoPrimary ? (
              <video
                src={resolveImageUrl((product as any).videoUrl)}
                poster={resolveImageUrl((product as any).videoPosterUrl || product.mainImageUrl)}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-contain"
                data-testid={`video-product-${product.id}`}
              />
            ) : product.mainImageUrl ? (
              <img
                src={resolveImageUrl(product.mainImageUrl)}
                alt={product.name}
                className="w-full h-full object-contain p-1"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-16 w-16 text-muted-foreground/30" />
              </div>
            )}
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              {product.hasDiscount && product.discountPercent && (
                <Badge className="bg-red-500 text-white">
                  <Percent className="h-3 w-3 mr-1" />
                  -{Math.round(product.discountPercent)}%
                </Badge>
              )}
              {product.discountType === "promotion" && product.promotionName && (
                <Badge variant="secondary" className="bg-orange-500 text-white">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {product.promotionName}
                </Badge>
              )}
            </div>
            <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
              {showFavorites && (
                <Button
                  size="icon"
                  variant="ghost"
                  className={`rounded-full bg-background/80 backdrop-blur-sm ${isFavorite ? 'text-red-500' : 'text-muted-foreground'}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleFavorite(product.id);
                  }}
                  data-testid={`button-favorite-${product.id}`}
                >
                  <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                </Button>
              )}
              {!isInStock && (
                <Badge variant="destructive">Нет в наличии</Badge>
              )}
            </div>
            {showQuickView && (
              <div className="hidden md:flex absolute inset-0 items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity cursor-pointer rounded-lg">
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onQuickView(product);
                  }}
                  data-testid={`button-quick-view-${product.id}`}
                >
                  <Eye className="h-5 w-5" />
                </Button>
              </div>
            )}
            {product.tags && product.tags.length > 0 && (
              <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
                {product.tags.slice(0, 2).map((tag: string) => {
                  const config = TAG_CONFIG[tag];
                  if (!config) return null;
                  return (
                    <Badge 
                      key={tag} 
                      className={`${config.color} text-white text-xs`}
                      data-testid={`badge-tag-${tag}-${product.id}`}
                    >
                      {config.label}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </Link>
        <CardContent className={compact ? "p-2.5" : "p-4"}>
          <Link href={`${basePath}/product/${product.id}`}>
            <h3 className={`font-medium cursor-pointer text-foreground ${compact ? "text-xs line-clamp-2 mb-1" : "line-clamp-2 mb-2"}`}>
              {product.name}
            </h3>
          </Link>
          <div className={`flex items-center justify-between mt-auto ${compact ? "gap-1" : "gap-2"}`}>
            <div className="flex flex-col min-w-0">
              {product.hasDiscount ? (
                <>
                  <p className={`font-bold text-red-500 ${compact ? "text-sm" : "text-lg"}`}>
                    {formatPrice(product.computedPrice)}
                  </p>
                  {!compact && (
                    <p className="text-sm text-muted-foreground line-through">
                      {formatPrice(product.originalPrice)}
                    </p>
                  )}
                </>
              ) : (
                <p className={`font-bold ${compact ? "text-sm" : "text-lg"}`}>{formatPrice(product.computedPrice)}</p>
              )}
            </div>
            <Button
              size={compact ? "icon" : "sm"}
              className={compact ? "h-7 w-7 shrink-0" : ""}
              disabled={!isInStock}
              onClick={handleAddToCart}
              data-testid={`button-add-cart-${product.id}`}
            >
              <ShoppingCart className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function QuickViewModal({
  product,
  isOpen,
  tenantSlug,
  basePath,
  onClose,
  isMobile,
}: {
  product: ProductWithPrice | null;
  isOpen: boolean;
  tenantSlug: string;
  basePath: string;
  onClose: () => void;
  isMobile: boolean;
}) {
  const { addItem } = useCart();
  const { toast } = useToast();

  if (!product) return null;

  const isInStock = product.alwaysInStock || product.inStock || product.stockQty > 0;
  const shortDescription = product.description
    ? product.description.substring(0, 200) + (product.description.length > 200 ? "..." : "")
    : "";

  const formatPrice = (value: number | string) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("ru-KZ").format(num) + " ₸";
  };

  const handleAddToCart = () => {
    addItem(product);
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
    onClose();
  };

  const modalContent = (
    <div className="space-y-4">
      <div className="w-full aspect-square bg-white dark:bg-neutral-900 rounded-lg overflow-hidden">
        {product.mainImageUrl ? (
          <img
            src={resolveImageUrl(product.mainImageUrl)}
            alt={product.name}
            className="w-full h-full object-contain p-1"
            data-testid={`img-quick-view-product-${product.id}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold mb-2" data-testid={`heading-product-name-${product.id}`}>
          {product.name}
        </h2>

        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {product.tags.slice(0, 3).map((tag: string) => {
              const config = TAG_CONFIG[tag];
              if (!config) return null;
              return (
                <Badge
                  key={tag}
                  className={`${config.color} text-white text-xs`}
                  data-testid={`badge-qv-tag-${tag}-${product.id}`}
                >
                  {config.label}
                </Badge>
              );
            })}
          </div>
        )}

        <div className="mb-4">
          {product.hasDiscount ? (
            <div className="flex items-center gap-2">
              <p
                className="text-2xl font-bold text-red-500"
                data-testid={`text-qv-price-${product.id}`}
              >
                {formatPrice(product.computedPrice)}
              </p>
              <p
                className="text-lg text-muted-foreground line-through"
                data-testid={`text-qv-original-price-${product.id}`}
              >
                {formatPrice(product.originalPrice)}
              </p>
              {product.discountPercent && (
                <Badge className="bg-red-500 text-white" data-testid={`badge-qv-discount-${product.id}`}>
                  -{Math.round(product.discountPercent)}%
                </Badge>
              )}
            </div>
          ) : (
            <p className="text-2xl font-bold" data-testid={`text-qv-price-${product.id}`}>
              {formatPrice(product.computedPrice)}
            </p>
          )}
        </div>

        {!isInStock && (
          <Badge variant="destructive" className="mb-3" data-testid={`badge-qv-out-of-stock-${product.id}`}>
            Нет в наличии
          </Badge>
        )}

        {shortDescription && (
          <p
            className="text-sm text-muted-foreground mb-4"
            data-testid={`text-qv-description-${product.id}`}
          >
            {shortDescription}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          disabled={!isInStock}
          onClick={handleAddToCart}
          className="w-full"
          data-testid={`button-qv-add-cart-${product.id}`}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Добавить в корзину
        </Button>
        <Link href={`${basePath}/product/${product.id}`}>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            data-testid={`button-qv-view-details-${product.id}`}
            onClick={onClose}
          >
            Подробнее о товаре
          </Button>
        </Link>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose} data-testid={`sheet-quick-view-${product.id}`}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle data-testid={`sheet-title-quick-view-${product.id}`}>
              Быстрый просмотр
            </SheetTitle>
          </SheetHeader>
          {modalContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose} data-testid={`dialog-quick-view-${product.id}`}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid={`dialog-title-quick-view-${product.id}`}>
            Быстрый просмотр
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-6">
          <div className="w-full aspect-square bg-white dark:bg-neutral-900 rounded-lg overflow-hidden">
            {product.mainImageUrl ? (
              <img
                src={resolveImageUrl(product.mainImageUrl)}
                alt={product.name}
                className="w-full h-full object-contain p-1"
                data-testid={`img-dialog-quick-view-product-${product.id}`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-16 w-16 text-muted-foreground/30" />
              </div>
            )}
          </div>
          {modalContent}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PromoCarousel({
  promoBlocks,
  tenantSlug,
  basePath,
}: {
  promoBlocks: PromoBlock[];
  tenantSlug: string;
  basePath: string;
  tenantPhone?: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoScrollPaused, setIsAutoScrollPaused] = useState(false);

  const scrollToIndex = useCallback((index: number) => {
    if (!scrollRef.current) return;
    const scrollContainer = scrollRef.current;
    const items = scrollContainer.children;
    if (items[index]) {
      const item = items[index] as HTMLElement;
      scrollContainer.scrollTo({
        left: item.offsetLeft - scrollContainer.offsetLeft,
        behavior: "smooth",
      });
    }
    setCurrentIndex(index);
  }, []);

  useEffect(() => {
    if (promoBlocks.length <= 1 || isAutoScrollPaused) return;
    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % promoBlocks.length;
      scrollToIndex(nextIndex);
    }, 5000);
    return () => clearInterval(interval);
  }, [currentIndex, promoBlocks.length, isAutoScrollPaused, scrollToIndex]);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const scrollLeft = scrollContainer.scrollLeft;
      const itemWidth = scrollContainer.offsetWidth;
      const newIndex = Math.round(scrollLeft / itemWidth);
      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < promoBlocks.length) {
        setCurrentIndex(newIndex);
      }
    };

    scrollContainer.addEventListener("scroll", handleScroll);
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [currentIndex, promoBlocks.length]);

  if (!promoBlocks || promoBlocks.length === 0) return null;

  return (
    <section 
      className="w-full" 
      data-testid="section-promo-carousel"
      onMouseEnter={() => setIsAutoScrollPaused(true)}
      onMouseLeave={() => setIsAutoScrollPaused(false)}
      onTouchStart={() => setIsAutoScrollPaused(true)}
      onTouchEnd={() => setTimeout(() => setIsAutoScrollPaused(false), 3000)}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4">
        <div className="relative">
          <div
            ref={scrollRef}
            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            data-testid="container-promo-slides"
          >
            {promoBlocks.map((block, index) => (
              <Link
                key={block.id}
                href={`${basePath}/promo/${block.id}`}
                className="flex-shrink-0 w-full snap-center cursor-pointer"
                data-testid={`link-promo-block-${block.id}`}
                onClick={() => {
                  fetch(`/api/catalog/${tenantSlug}/promo/${block.id}/banner-click`, {
                    method: "POST",
                  }).catch(() => {});
                }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="relative aspect-[21/9] md:aspect-[3/1] rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {block.mediaType === "video" ? (
                    <video
                      src={resolveImageUrl(block.imageUrl)}
                      className="w-full h-full object-cover"
                      autoPlay
                      muted
                      loop
                      playsInline
                      data-testid={`video-promo-${block.id}`}
                    />
                  ) : (
                    <img
                      src={resolveImageUrl(block.imageUrl)}
                      alt={block.title || "Promo"}
                      className="w-full h-full object-cover"
                      loading={index === 0 ? "eager" : "lazy"}
                      data-testid={`img-promo-${block.id}`}
                    />
                  )}
                </motion.div>
              </Link>
            ))}
          </div>

          {promoBlocks.length > 1 && (
            <>
              <button
                onClick={() => scrollToIndex((currentIndex - 1 + promoBlocks.length) % promoBlocks.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-white/80 hover:bg-white text-black shadow-lg transition-all"
                aria-label="Previous slide"
                data-testid="button-promo-prev"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => scrollToIndex((currentIndex + 1) % promoBlocks.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-white/80 hover:bg-white text-black shadow-lg transition-all"
                aria-label="Next slide"
                data-testid="button-promo-next"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              <div className="flex justify-center gap-2 mt-3" data-testid="container-promo-dots">
                {promoBlocks.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => scrollToIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentIndex
                        ? "bg-primary w-6"
                        : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                    data-testid={`button-promo-dot-${index}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default function CatalogHome({ basePath: parentBasePath }: { basePath?: string }) {
  const { slug, basePath: hookBasePath } = useCatalogSlug("/c/:slug");
  const basePath = parentBasePath !== undefined ? parentBasePath : hookBasePath;
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [sizeFilter, setSizeFilter] = useState<string>("all");
  const [colorFilter, setColorFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState("default");
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table'>('grid');
  const [mobileColumns, setMobileColumns] = useState<1 | 2>(() => {
    try {
      const saved = localStorage.getItem(`catalog_mobile_cols_${slug}`);
      return saved === '2' ? 2 : 1;
    } catch { return 1; }
  });
  const [brandFilter, setBrandFilter] = useState("all");
  const { items, totalItems, lastAddedAt, addItem } = useCart();
  const { toast } = useToast();
  const { isFavorite, toggleFavorite } = useFavorites(slug);
  const [isCartPulsing, setIsCartPulsing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithPrice | null>(null);
  const isMobile = useIsMobile();

  const toggleMobileColumns = () => {
    const next = mobileColumns === 1 ? 2 : 1;
    setMobileColumns(next);
    try { localStorage.setItem(`catalog_mobile_cols_${slug}`, String(next)); } catch {}
  };
  
  useEffect(() => {
    if (lastAddedAt > 0) {
      setIsCartPulsing(true);
      const timer = setTimeout(() => setIsCartPulsing(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [lastAddedAt]);

  const { data, isLoading, error } = useQuery<CatalogData>({
    queryKey: ["/api/catalog", slug],
    enabled: !!slug,
  });

  const { data: promoBlocks = [] } = useQuery<PromoBlock[]>({
    queryKey: ["/api/catalog", slug, "promo-blocks"],
    enabled: !!slug,
  });

  // Set OG meta tags for messenger sharing
  useEffect(() => {
    if (!data?.tenant) return;
    
    const tenant = data.tenant as any;
    
    // Update title
    document.title = tenant.ogTitle || tenant.name || "Каталог";
    
    // Helper to set/update meta tag
    const setMetaTag = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("property", property);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };
    
    // Set OG meta tags
    setMetaTag("og:title", tenant.ogTitle || tenant.name || "Каталог");
    setMetaTag("og:description", tenant.ogDescription || tenant.description || "Онлайн-каталог товаров");
    if (tenant.ogImageUrl) {
      setMetaTag("og:image", tenant.ogImageUrl);
    }
    setMetaTag("og:type", "website");
    setMetaTag("og:url", window.location.href);
    
    return () => {
      // Cleanup on unmount
      document.title = "SmartCatalog";
    };
  }, [data?.tenant]);

  // Track catalog view
  const trackedRef = useRef(false);
  useEffect(() => {
    if (slug && !trackedRef.current) {
      trackedRef.current = true;
      trackEvent({ tenantSlug: slug, eventType: 'catalog_view' });
    }
  }, [slug]);

  const getSubcategoryIds = (parentId: string): string[] => {
    return data?.categories?.filter(c => c.parentId === parentId).map(c => c.id) || [];
  };

  const availableSizes = Array.from(new Set(
    data?.products?.flatMap(p => {
      const sizes = (p as any).sizes || [];
      return sizes.map((s: string | {size: string; qty: number}) => 
        typeof s === 'object' ? s.size : s
      );
    }) || []
  )).sort() as string[];

  const colorMap = new Map<string, {name: string; hex: string}>();
  data?.products?.forEach(p => {
    const colors = (p as any).colors || [];
    colors.forEach((c: {name: string; hex: string}) => {
      if (!colorMap.has(c.hex)) colorMap.set(c.hex, c);
    });
  });
  const availableColors = Array.from(colorMap.values());

  const availableBrands = Array.from(new Set(
    data?.products?.map(p => (p as any).brand).filter(Boolean) || []
  )).sort() as string[];

  const filteredProducts = data?.products?.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase());
    let matchesCategory = categoryFilter === "all";
    if (!matchesCategory && product.categoryId) {
      if (product.categoryId === categoryFilter) {
        matchesCategory = true;
      } else {
        const subcatIds = getSubcategoryIds(categoryFilter);
        matchesCategory = subcatIds.includes(product.categoryId);
      }
    }
    const isInStock = product.alwaysInStock || product.inStock || product.stockQty > 0;
    const matchesStock =
      stockFilter === "all" ||
      (stockFilter === "in_stock" && isInStock) ||
      (stockFilter === "out_of_stock" && !isInStock);
    
    const productSizes = ((product as any).sizes || []) as Array<string | {size: string; qty: number}>;
    const productColors = ((product as any).colors || []) as {name: string; hex: string}[];
    const sizeColorStock = ((product as any).sizeColorStock || []) as {size: string; colorHex: string; qty: number}[];
    
    let matchesSize = sizeFilter === "all";
    let matchesColor = colorFilter === "all";
    
    if (!matchesSize || !matchesColor) {
      if (sizeColorStock.length > 0 && productColors.length > 0) {
        if (!matchesSize && !matchesColor) {
          const stockItem = sizeColorStock.find(s => s.size === sizeFilter && s.colorHex === colorFilter);
          const isAvailable = (stockItem?.qty ?? 0) > 0 || product.alwaysInStock;
          matchesSize = isAvailable;
          matchesColor = isAvailable;
        } else if (!matchesSize) {
          matchesSize = sizeColorStock.some(s => s.size === sizeFilter && s.qty > 0) || product.alwaysInStock;
        } else if (!matchesColor) {
          matchesColor = sizeColorStock.some(s => s.colorHex === colorFilter && s.qty > 0) || product.alwaysInStock;
        }
      } else {
        if (!matchesSize) {
          matchesSize = productSizes.some(s => {
            const sizeLabel = typeof s === 'object' ? s.size : s;
            const isAvailable = typeof s === 'object' ? (s.qty > 0 || product.alwaysInStock) : true;
            return sizeLabel === sizeFilter && isAvailable;
          });
        }
        if (!matchesColor) {
          matchesColor = productColors.some(c => c.hex === colorFilter);
        }
      }
    }

    const matchesBrand = brandFilter === "all" || (product as any).brand === brandFilter;

    return product.isActive && matchesSearch && matchesCategory && matchesStock && matchesSize && matchesColor && matchesBrand;
  });

  // Build a map of categoryId -> sortOrder for fast lookup
  const categorySortMap = new Map<string, number>(
    (data?.categories || []).map(c => [c.id, c.sortOrder ?? 0])
  );

  const sortedProducts = filteredProducts ? filteredProducts.slice().sort((a, b) => {
    switch (sortOrder) {
      case "price_asc":
        return parseFloat(a.computedPrice) - parseFloat(b.computedPrice);
      case "price_desc":
        return parseFloat(b.computedPrice) - parseFloat(a.computedPrice);
      case "name_asc":
        return a.name.localeCompare(b.name, "ru");
      case "newest":
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      default: {
        // Default: sort by category position first, then product sort order
        // Products without a category go to the very end
        const aCatOrder = a.categoryId != null ? (categorySortMap.get(a.categoryId) ?? 9999) : 99999;
        const bCatOrder = b.categoryId != null ? (categorySortMap.get(b.categoryId) ?? 9999) : 99999;
        if (aCatOrder !== bCatOrder) return aCatOrder - bCatOrder;
        const aProd = (a as any).sortOrder ?? 0;
        const bProd = (b as any).sortOrder ?? 0;
        return aProd - bProd;
      }
    }
  }) : [];

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Package className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Каталог не найден</h1>
          <p className="text-muted-foreground">
            Проверьте правильность ссылки или обратитесь к владельцу магазина
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/95 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link href={`${basePath || "/"}`}>
              <div className="flex flex-col cursor-pointer">
                <div className="flex items-center gap-3">
                  {data?.tenant?.logoUrl && (
                    <img 
                      src={resolveImageUrl(data.tenant.logoUrl)} 
                      alt={data.tenant.name} 
                      className="h-10 w-10 object-contain rounded-lg"
                    />
                  )}
                  <h1 className="text-xl font-bold tracking-tight">
                    {data?.tenant?.name || "Каталог"}
                  </h1>
                </div>
                {(data?.tenant as any)?.catalogUsp && (
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1" data-testid="text-catalog-usp">
                    {(data.tenant as any).catalogUsp}
                  </p>
                )}
              </div>
            </Link>
            <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
              {(data?.tenant as any)?.workingHours && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {(data?.tenant as any).workingHours}
                </span>
              )}
              {data?.tenant?.contactPhone && (
                <a 
                  href={`tel:${data.tenant.contactPhone}`}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  {data.tenant.contactPhone}
                </a>
              )}
              {data?.tenant?.address && (
                (data?.tenant as any)?.gisLink ? (
                  <a 
                    href={(data.tenant as any).gisLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-1 hover:text-foreground transition-colors"
                  >
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{data.tenant.address}</span>
                  </a>
                ) : (
                  <span className="flex items-start gap-1">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{data.tenant.address}</span>
                  </span>
                )
              )}
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle variant="catalog" />
              <Link href={`${basePath}/cart`}>
                <Button variant="outline" className="relative" data-testid="button-cart">
                  <ShoppingCart className="h-5 w-5" />
                  {totalItems > 0 && (
                    <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                      {totalItems}
                    </span>
                  )}
                </Button>
              </Link>
            </div>
          </div>
          {/* Mobile contact info */}
          {(data?.tenant?.contactPhone || data?.tenant?.address || (data?.tenant as any)?.workingHours) && (
            <div className="flex md:hidden flex-wrap items-center justify-center gap-3 pb-3 text-xs text-muted-foreground">
              {data?.tenant?.contactPhone && (
                <a 
                  href={`tel:${data.tenant.contactPhone}`}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  <Phone className="h-3 w-3" />
                  {data.tenant.contactPhone}
                </a>
              )}
              {(data?.tenant as any)?.workingHours && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {(data?.tenant as any).workingHours}
                </span>
              )}
              {data?.tenant?.address && (
                (data?.tenant as any)?.gisLink ? (
                  <a 
                    href={(data.tenant as any).gisLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-1 hover:text-foreground text-center"
                  >
                    <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                    <span>{data.tenant.address}</span>
                  </a>
                ) : (
                  <span className="flex items-start gap-1 text-center">
                    <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                    <span>{data.tenant.address}</span>
                  </span>
                )
              )}
            </div>
          )}
        </div>
      </header>

      {promoBlocks.length > 0 && (
        <PromoCarousel
          promoBlocks={promoBlocks}
          tenantSlug={slug}
          basePath={basePath}
          tenantPhone={data?.tenant?.contactPhone}
        />
      )}

      {/* Demo banner for testing */}
      {slug === "demo" && (
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border-b">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Попробуйте сами!</p>
                  <p className="text-sm text-muted-foreground">
                    Оформите заказ и получите его себе в WhatsApp
                  </p>
                </div>
              </div>
              <Link href={`${basePath}/cart`}>
                <Button size="sm" data-testid="button-demo-cta">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Перейти к оформлению
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        {data?.promotions && data.promotions.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Акции</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.promotions.filter(p => p.isActive).slice(0, 3).map((promo) => (
                <Card key={promo.id} className="bg-gradient-to-r from-primary/10 to-primary/5">
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-1">{promo.title}</h3>
                    {promo.description && (
                      <p className="text-sm text-muted-foreground">{promo.description}</p>
                    )}
                    {promo.conditionsText && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {promo.conditionsText}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск товаров..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-category">
              <SelectValue placeholder="Категория" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории</SelectItem>
              {data?.categories?.filter(c => !c.parentId).map((parentCat) => (
                <div key={parentCat.id}>
                  <SelectItem value={parentCat.id}>
                    {parentCat.name}
                  </SelectItem>
                  {data.categories?.filter(sub => sub.parentId === parentCat.id).map((subCat) => (
                    <SelectItem key={subCat.id} value={subCat.id} className="pl-6">
                      ↳ {subCat.name}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-full sm:w-40" data-testid="select-stock">
              <SelectValue placeholder="Наличие" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все товары</SelectItem>
              <SelectItem value="in_stock">В наличии</SelectItem>
            </SelectContent>
          </Select>
          {availableBrands.length > 0 && (
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-full sm:w-44" data-testid="select-brand">
                <SelectValue placeholder="Бренд" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все бренды</SelectItem>
                {availableBrands.map((brand) => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {(availableSizes.length > 0 || availableColors.length > 0) && (
          <div className="flex flex-wrap items-center gap-3 mb-6 p-3 bg-muted/50 rounded-lg">
            <Filter className="h-4 w-4 text-muted-foreground" />

            {availableSizes.length > 0 && (
              <Select value={sizeFilter} onValueChange={setSizeFilter}>
                <SelectTrigger className="w-auto min-w-[100px]" data-testid="select-size">
                  <SelectValue placeholder="Размер" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все размеры</SelectItem>
                  {availableSizes.map((size) => (
                    <SelectItem key={size} value={size}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {availableColors.length > 0 && (
              <Select value={colorFilter} onValueChange={setColorFilter}>
                <SelectTrigger className="w-auto min-w-[100px]" data-testid="select-color">
                  <SelectValue placeholder="Цвет" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все цвета</SelectItem>
                  {availableColors.map((color) => (
                    <SelectItem key={color.hex} value={color.hex}>
                      <span className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full border border-border"
                          style={{ backgroundColor: color.hex }}
                        />
                        {color.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {(sizeFilter !== "all" || colorFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSizeFilter("all");
                  setColorFilter("all");
                }}
                data-testid="button-clear-filters"
              >
                Сбросить
              </Button>
            )}
          </div>
        )}


        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <p className="text-sm text-muted-foreground" data-testid="text-product-count">
            Найдено: {sortedProducts.length} товаров
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-auto min-w-[180px]" data-testid="select-sort">
                <ArrowUpDown className="h-4 w-4 mr-2 shrink-0" />
                <SelectValue placeholder="Сортировка" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">По умолчанию</SelectItem>
                <SelectItem value="price_asc">Цена: по возрастанию</SelectItem>
                <SelectItem value="price_desc">Цена: по убыванию</SelectItem>
                <SelectItem value="name_asc">По названию А-Я</SelectItem>
                <SelectItem value="newest">Новинки</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              {viewMode === 'grid' && (
                <Button
                  size="icon"
                  variant={mobileColumns === 2 ? "default" : "outline"}
                  onClick={toggleMobileColumns}
                  data-testid="button-mobile-columns-toggle"
                  className="sm:hidden"
                >
                  {mobileColumns === 1 ? <Grid2x2 className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                </Button>
              )}
              <Button
                size="icon"
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                onClick={() => setViewMode('grid')}
                data-testid="button-view-grid"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant={viewMode === 'list' ? 'default' : 'outline'}
                onClick={() => setViewMode('list')}
                data-testid="button-view-list"
              >
                <ListIcon className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant={viewMode === 'table' ? 'default' : 'outline'}
                onClick={() => setViewMode('table')}
                data-testid="button-view-table"
              >
                <Table2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className={`grid ${mobileColumns === 2 ? 'grid-cols-2' : 'grid-cols-1'} sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`}>
            {[...Array(8)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : sortedProducts.length > 0 ? (
          <>
            {viewMode === 'grid' && (
              <div className={`grid ${mobileColumns === 2 ? 'grid-cols-2 gap-2' : 'grid-cols-1 gap-4'} sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4`}>
                {sortedProducts.map((product) => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    tenantSlug={slug}
                    basePath={basePath}
                    isFavorite={isFavorite(product.id)}
                    onToggleFavorite={toggleFavorite}
                    onQuickView={setSelectedProduct}
                    showFavorites={(data?.tenant as any)?.showFavorites !== false}
                    showQuickView={(data?.tenant as any)?.showQuickView !== false}
                    compact={isMobile && mobileColumns === 2}
                  />
                ))}
              </div>
            )}

            {viewMode === 'list' && (
              <div className="flex flex-col gap-4">
                {sortedProducts.map((product) => {
                  const isInStock = product.alwaysInStock || product.inStock || product.stockQty > 0;
                  const formatPrice = (value: number | string) => {
                    const num = typeof value === "string" ? parseFloat(value) : value;
                    return new Intl.NumberFormat("ru-KZ").format(num) + " ₸";
                  };
                  return (
                    <Card key={product.id} className="hover-elevate">
                      <CardContent className="p-4 flex items-center gap-4">
                        <Link href={`${basePath}/product/${product.id}`}>
                          <div className="w-24 h-24 rounded-lg overflow-hidden bg-white dark:bg-neutral-900 shrink-0 cursor-pointer relative">
                            {product.mainImageUrl ? (
                              <img
                                src={resolveImageUrl(product.mainImageUrl)}
                                alt={product.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-8 w-8 text-muted-foreground/30" />
                              </div>
                            )}
                          </div>
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link href={`${basePath}/product/${product.id}`}>
                            <h3 className="font-medium line-clamp-1 cursor-pointer text-foreground">{product.name}</h3>
                          </Link>
                          {product.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {product.description.substring(0, 120)}{product.description.length > 120 ? "..." : ""}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            {product.hasDiscount ? (
                              <>
                                <span className="font-bold text-red-500">{formatPrice(product.computedPrice)}</span>
                                <span className="text-sm text-muted-foreground line-through">{formatPrice(product.originalPrice)}</span>
                              </>
                            ) : (
                              <span className="font-bold">{formatPrice(product.computedPrice)}</span>
                            )}
                            {!isInStock && <Badge variant="destructive" className="ml-2">Нет в наличии</Badge>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {(data?.tenant as any)?.showFavorites !== false && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className={isFavorite(product.id) ? 'text-red-500' : 'text-muted-foreground'}
                              onClick={() => toggleFavorite(product.id)}
                              data-testid={`button-favorite-${product.id}`}
                            >
                              <Heart className={`h-4 w-4 ${isFavorite(product.id) ? 'fill-current' : ''}`} />
                            </Button>
                          )}
                          {(data?.tenant as any)?.showQuickView !== false && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setSelectedProduct(product)}
                              data-testid={`button-quick-view-${product.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            disabled={!isInStock}
                            onClick={() => {
                              addItem(product);
                              toast({
                                title: "Добавлено в корзину",
                                description: product.name,
                              });
                            }}
                            data-testid={`button-add-cart-${product.id}`}
                          >
                            <ShoppingCart className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {viewMode === 'table' && (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Фото</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Название</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground hidden md:table-cell">Категория</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Цена</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground hidden sm:table-cell">Наличие</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedProducts.map((product) => {
                        const isInStock = product.alwaysInStock || product.inStock || product.stockQty > 0;
                        const formatPrice = (value: number | string) => {
                          const num = typeof value === "string" ? parseFloat(value) : value;
                          return new Intl.NumberFormat("ru-KZ").format(num) + " ₸";
                        };
                        const category = data?.categories?.find(c => c.id === product.categoryId);
                        return (
                          <tr key={product.id} className="border-b last:border-b-0">
                            <td className="p-3">
                              <Link href={`${basePath}/product/${product.id}`}>
                                <div className="w-12 h-12 rounded-md overflow-hidden bg-white dark:bg-neutral-900 cursor-pointer">
                                  {product.mainImageUrl ? (
                                    <img
                                      src={resolveImageUrl(product.mainImageUrl)}
                                      alt={product.name}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Package className="h-4 w-4 text-muted-foreground/30" />
                                    </div>
                                  )}
                                </div>
                              </Link>
                            </td>
                            <td className="p-3">
                              <Link href={`${basePath}/product/${product.id}`}>
                                <span className="font-medium text-sm cursor-pointer text-foreground line-clamp-1">{product.name}</span>
                              </Link>
                            </td>
                            <td className="p-3 hidden md:table-cell">
                              <span className="text-sm text-muted-foreground">{category?.name || "—"}</span>
                            </td>
                            <td className="p-3">
                              {product.hasDiscount ? (
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-red-500">{formatPrice(product.computedPrice)}</span>
                                  <span className="text-xs text-muted-foreground line-through">{formatPrice(product.originalPrice)}</span>
                                </div>
                              ) : (
                                <span className="text-sm font-bold">{formatPrice(product.computedPrice)}</span>
                              )}
                            </td>
                            <td className="p-3 hidden sm:table-cell">
                              {isInStock ? (
                                <Badge variant="secondary">В наличии</Badge>
                              ) : (
                                <Badge variant="destructive">Нет</Badge>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-end gap-1">
                                {(data?.tenant as any)?.showFavorites !== false && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className={isFavorite(product.id) ? 'text-red-500' : 'text-muted-foreground'}
                                    onClick={() => toggleFavorite(product.id)}
                                    data-testid={`button-favorite-${product.id}`}
                                  >
                                    <Heart className={`h-4 w-4 ${isFavorite(product.id) ? 'fill-current' : ''}`} />
                                  </Button>
                                )}
                                {(data?.tenant as any)?.showQuickView !== false && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setSelectedProduct(product)}
                                    data-testid={`button-quick-view-${product.id}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  disabled={!isInStock}
                                  onClick={() => {
                                    addItem(product);
                                    toast({
                                      title: "Добавлено в корзину",
                                      description: product.name,
                                    });
                                  }}
                                  data-testid={`button-add-cart-${product.id}`}
                                >
                                  <ShoppingCart className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <Package className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Товары не найдены</h2>
            <p className="text-muted-foreground">
              Попробуйте изменить фильтры или поисковый запрос
            </p>
          </div>
        )}
      </main>

      <footer className="border-t border-border py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-12">
            <div className="text-center md:text-left flex-1">
              {data?.tenant?.logoUrl && (
                <img 
                  src={resolveImageUrl(data.tenant.logoUrl)} 
                  alt={data.tenant.name} 
                  className="h-12 w-12 object-contain rounded-lg mx-auto md:mx-0 mb-3"
                />
              )}
              <p className="font-semibold mb-2">{data?.tenant?.name}</p>
              {data?.tenant?.description && (
                <p className="text-sm text-muted-foreground max-w-md">
                  {data.tenant.description}
                </p>
              )}
            </div>
            <div className="text-center md:text-right text-sm text-muted-foreground space-y-1">
              {data?.tenant?.contactPhone && (
                <p>
                  <a href={`tel:${data.tenant.contactPhone}`} className="hover:text-foreground">
                    {data.tenant.contactPhone}
                  </a>
                </p>
              )}
              {data?.tenant?.address && (
                <p>
                  {(data?.tenant as any)?.gisLink ? (
                    <a 
                      href={(data.tenant as any).gisLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-foreground"
                    >
                      {data.tenant.address}
                    </a>
                  ) : (
                    data.tenant.address
                  )}
                </p>
              )}
              {(data?.tenant as any)?.workingHours && (
                <p>{(data?.tenant as any)?.workingHours}</p>
              )}
              <p className="pt-2">© {new Date().getFullYear()}</p>
            </div>
          </div>
        </div>
      </footer>

      <QuickViewModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        tenantSlug={slug}
        basePath={basePath}
        onClose={() => setSelectedProduct(null)}
        isMobile={isMobile}
      />

      {/* Floating WhatsApp Button */}
      {(data?.tenant?.notificationPhone || data?.tenant?.contactPhone) && data.tenant.showFloatingWhatsApp && (
        <motion.div
          initial={{ scale: 0, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-6 right-6 z-50"
        >
          <Button
            className="h-14 w-14 rounded-full shadow-lg bg-[#25D366] hover:bg-[#25D366]/90 text-white group flex items-center justify-center"
            onClick={() => {
              const phone = (data.tenant.notificationPhone || data.tenant.contactPhone)!.replace(/\D/g, "");
              const message = encodeURIComponent("Здравствуйте! Хочу узнать подробнее");
              window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
            }}
            data-testid="button-floating-whatsapp"
          >
            <MessageCircle className="h-6 w-6 group-hover:animate-pulse" />
          </Button>
        </motion.div>
      )}

      {/* Floating Cart Button for Mobile */}
      {totalItems > 0 && (
        <Link href={`${basePath}/cart`}>
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className={`fixed bottom-24 right-6 z-50 md:hidden ${isCartPulsing ? 'animate-bounce' : ''}`}
          >
            <Button 
              size="lg" 
              className={`h-16 w-16 rounded-full shadow-lg ${isCartPulsing ? 'ring-4 ring-primary/50' : ''}`}
              data-testid="button-floating-cart"
            >
              <div className="relative">
                <ShoppingCart className="h-6 w-6" />
                <span className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                  {totalItems}
                </span>
              </div>
            </Button>
          </motion.div>
        </Link>
      )}
    </div>
  );
}
