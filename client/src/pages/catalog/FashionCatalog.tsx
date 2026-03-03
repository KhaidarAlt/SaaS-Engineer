import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  X,
  Package,
  Flame,
  LayoutGrid,
  Rows3,
  Share2,
  Search,
  Home,
  ShoppingBag,
  ChevronRight,
  Phone,
  MapPin,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { resolveImageUrl } from "@/lib/imageUrl";

interface FashionCatalogProps {
  slug: string;
  basePath: string;
  tenant: any;
  products: any[];
  categories: any[];
}

const TAG_CONFIG: Record<string, { label: string; color: string; gradient: string }> = {
  hit: { label: "Хит", color: "bg-amber-500", gradient: "from-amber-500 to-orange-500" },
  new: { label: "Новинка", color: "bg-blue-500", gradient: "from-blue-500 to-cyan-400" },
  best_price: { label: "Лучшая цена", color: "bg-emerald-500", gradient: "from-emerald-500 to-teal-400" },
  sale: { label: "Скидка", color: "bg-red-500", gradient: "from-rose-500 to-red-500" },
};

function useFavorites(tenantSlug: string) {
  const storageKey = `favorites_${tenantSlug}`;
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
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
  const count = favorites.length;
  return { favorites, toggleFavorite, isFavorite, count };
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

function getPurchaseCount(productId: string): number {
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = (hash * 17 + productId.charCodeAt(i)) % 1000;
  }
  return 10 + (hash % 990);
}

const HEADER_HEIGHT = 56;
const CATEGORIES_HEIGHT = 48;
const TOTAL_TOP = HEADER_HEIGHT + CATEGORIES_HEIGHT;
const BOTTOM_NAV_HEIGHT = 64;

const CSS_ANIMATIONS = `
@keyframes heartBounce {
  0% { transform: scale(1); }
  15% { transform: scale(1.4); }
  30% { transform: scale(0.9); }
  45% { transform: scale(1.2); }
  60% { transform: scale(1); }
}
@keyframes bagPulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.25); }
  100% { transform: scale(1); }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 8px rgba(244,63,94,0.3); }
  50% { box-shadow: 0 0 20px rgba(244,63,94,0.6); }
}
`;

function CarouselSection({
  title,
  products,
  basePath,
  isFavorite,
  onToggleFavorite,
  onQuickAddToCart,
}: {
  title: string;
  products: any[];
  basePath: string;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  onQuickAddToCart: (product: any) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  if (products.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between px-3 mb-2.5">
        <h2 className="text-gray-900 dark:text-white font-bold text-base">{title}</h2>
        <span className="text-gray-400 dark:text-white/40 text-xs flex items-center gap-0.5">
          {products.length} товаров <ChevronRight className="h-3 w-3" />
        </span>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-2.5 px-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
        style={{ scrollPaddingLeft: 12 }}
      >
        {products.map((product) => {
          const imageUrl = resolveImageUrl(product.mainImageUrl);
          const fav = isFavorite(product.id);
          return (
            <div
              key={product.id}
              className="snap-start shrink-0 w-[44vw] max-w-[200px]"
              data-testid={`carousel-card-${product.id}`}
            >
              <div className="rounded-2xl overflow-hidden bg-gray-100 dark:bg-neutral-900/70 backdrop-blur border border-gray-200 dark:border-white/[0.06]">
                <Link href={`${basePath}/product/${product.id}`}>
                  <div className="aspect-[4/5] relative overflow-hidden group cursor-pointer">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={product.name}
                        className="w-full h-full object-contain p-1 transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 dark:bg-neutral-800 flex items-center justify-center">
                        <Package className="h-8 w-8 text-gray-400 dark:text-neutral-600" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(product.id); }}
                      className="absolute top-2 right-2 z-10"
                    >
                      <Heart className={`h-5 w-5 drop-shadow-lg transition-all duration-300 ${fav ? "text-rose-500 fill-rose-500" : "text-white/80"}`} />
                    </button>
                    {product.hasDiscount && product.discountPercent && (
                      <span className="absolute bottom-2 left-2 bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md z-10">
                        -{Math.round(product.discountPercent)}%
                      </span>
                    )}
                  </div>
                </Link>
                <div className="p-2.5 space-y-1">
                  <p className="text-gray-800 dark:text-white/90 text-xs font-medium line-clamp-1">{product.name}</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-sm font-bold ${product.hasDiscount ? "bg-gradient-to-r from-rose-400 to-fuchsia-400 bg-clip-text text-transparent" : "text-gray-900 dark:text-white"}`}>
                      {formatPrice(product.computedPrice || product.price)}
                    </span>
                    {product.hasDiscount && (
                      <span className="text-gray-300 dark:text-white/30 text-[10px] line-through">{formatPrice(product.originalPrice)}</span>
                    )}
                  </div>
                  <button
                    onClick={() => onQuickAddToCart(product)}
                    className="w-full mt-1 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-gray-700 dark:text-white/80 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                    data-testid={`carousel-cart-${product.id}`}
                  >
                    <ShoppingBag className="h-3 w-3" /> В корзину
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GridProductCard({
  product,
  basePath,
  isFavorite,
  onToggleFavorite,
  onQuickAddToCart,
  index,
}: {
  product: any;
  basePath: string;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onQuickAddToCart: (product: any) => void;
  index: number;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);
  const [bagAnim, setBagAnim] = useState(false);
  const imageUrl = resolveImageUrl(product.mainImageUrl);
  const viewers = getViewerCount(product.id);
  const purchaseCount = getPurchaseCount(product.id);

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite(product.id);
    if (!isFavorite) {
      setHeartAnim(true);
      setTimeout(() => setHeartAnim(false), 600);
    }
  };

  const handleAddCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBagAnim(true);
    setTimeout(() => setBagAnim(false), 400);
    onQuickAddToCart(product);
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
    <div
      className="opacity-0"
      style={{ animation: `fadeInUp 0.4s ease-out ${index * 0.06}s forwards` }}
      data-testid={`card-product-${product.id}`}
    >
      <div className="rounded-2xl overflow-hidden bg-gray-100 dark:bg-neutral-900/70 backdrop-blur-xl border border-gray-200 dark:border-white/[0.06] shadow-xl shadow-gray-300/30 dark:shadow-black/30 transition-transform duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-rose-500/10">
        <Link href={`${basePath}/product/${product.id}`}>
          <div className="aspect-[4/5] relative overflow-hidden cursor-pointer group">
            {(product as any).videoUrl && (product as any).videoPrimary ? (
              <video
                src={resolveImageUrl((product as any).videoUrl)}
                poster={resolveImageUrl((product as any).videoPosterUrl || product.mainImageUrl)}
                autoPlay muted loop playsInline
                className="w-full h-full object-contain bg-white dark:bg-black transition-transform duration-700 group-hover:scale-110"
                data-testid={`video-product-${product.id}`}
              />
            ) : imageUrl ? (
              <>
                <img
                  src={imageUrl}
                  alt={product.name}
                  className={`w-full h-full object-contain p-1 transition-all duration-700 group-hover:scale-110 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                  loading="lazy"
                  onLoad={() => setImgLoaded(true)}
                  data-testid={`img-product-${product.id}`}
                />
                {!imgLoaded && (
                  <div className="absolute inset-0 bg-gray-200 dark:bg-neutral-800 animate-pulse" />
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-neutral-800">
                <Package className="h-12 w-12 text-gray-400 dark:text-neutral-600" />
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent pointer-events-none" />

            <button
              onClick={handleFavorite}
              className="absolute top-3 right-3 z-10 p-1"
              data-testid={`button-favorite-${product.id}`}
            >
              <Heart
                className={`h-6 w-6 drop-shadow-lg transition-all duration-300 ${
                  isFavorite ? "text-rose-500 fill-rose-500" : "text-white/90"
                }`}
                style={heartAnim ? { animation: "heartBounce 0.6s ease-in-out" } : undefined}
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
                      className={`bg-gradient-to-r ${config.gradient} text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-lg`}
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
                  className="bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-lg shadow-rose-500/30"
                  style={{ animation: "glowPulse 2s infinite" }}
                  data-testid={`badge-discount-${product.id}`}
                >
                  -{Math.round(product.discountPercent)}%
                </span>
              </div>
            )}

            <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1.5">
              <button
                onClick={handleShare}
                className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center hover:bg-white/25 transition-all border border-white/10"
                data-testid={`button-share-card-${product.id}`}
              >
                <Share2 className="h-4 w-4 text-white" />
              </button>
              <button
                onClick={handleAddCart}
                className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center hover:bg-white/25 transition-all border border-white/10"
                data-testid={`button-cart-${product.id}`}
              >
                <ShoppingBag
                  className="h-4 w-4 text-white"
                  style={bagAnim ? { animation: "bagPulse 0.4s ease-in-out" } : undefined}
                />
              </button>
            </div>
          </div>
        </Link>

        <div className="p-3 space-y-1.5">
          {product.colors && product.colors.length > 0 && (
            <div className="flex items-center gap-1">
              {product.colors.slice(0, 5).map((c: { name: string; hex: string }) => (
                <span
                  key={c.hex}
                  className="w-3.5 h-3.5 rounded-full border border-gray-200 dark:border-white/15 shrink-0 ring-1 ring-black/30"
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                />
              ))}
              {product.colors.length > 5 && (
                <span className="text-[10px] text-gray-300 dark:text-white/30 ml-0.5">+{product.colors.length - 5}</span>
              )}
            </div>
          )}

          <Link href={`${basePath}/product/${product.id}`}>
            <h3 className="text-gray-900 dark:text-white font-semibold text-sm line-clamp-2 cursor-pointer leading-snug hover:text-rose-200 transition-colors" data-testid={`text-product-name-${product.id}`}>
              {product.name}
            </h3>
          </Link>

          {product.brand && (
            <span className="text-gray-400 dark:text-white/35 text-[11px] block" data-testid={`badge-brand-${product.id}`}>
              {product.brand}
            </span>
          )}

          <div className="flex items-baseline gap-2">
            {product.hasDiscount ? (
              <>
                <span className="font-extrabold text-[15px] bg-gradient-to-r from-rose-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent" data-testid={`text-price-${product.id}`}>
                  {formatPrice(product.computedPrice)}
                </span>
                <span className="text-gray-300 dark:text-white/25 text-xs line-through" data-testid={`text-original-price-${product.id}`}>
                  {formatPrice(product.originalPrice)}
                </span>
              </>
            ) : (
              <span className="text-gray-900 dark:text-white font-bold text-[15px]" data-testid={`text-price-${product.id}`}>
                {formatPrice(product.computedPrice || product.price)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 text-[11px] text-gray-400 dark:text-white/35">
            <span className="flex items-center gap-0.5" data-testid={`text-purchases-${product.id}`}>
              <ShoppingBag className="h-3 w-3 text-emerald-400/60" />
              Купили {purchaseCount} раз
            </span>
            <span className="flex items-center gap-0.5" data-testid={`text-viewers-${product.id}`}>
              <Flame className="h-3 w-3 text-rose-400/60" />
              {viewers}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BottomNavBar({
  basePath,
  totalItems,
  favCount,
  searchOpen,
  showFavoritesOnly,
  onToggleSearch,
  onToggleFavorites,
}: {
  basePath: string;
  totalItems: number;
  favCount: number;
  searchOpen: boolean;
  showFavoritesOnly: boolean;
  onToggleSearch: () => void;
  onToggleFavorites: () => void;
}) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/70 dark:bg-black/70 backdrop-blur-xl border-t border-gray-200 dark:border-white/[0.06]"
      style={{ height: BOTTOM_NAV_HEIGHT }}
      data-testid="nav-bottom-bar"
    >
      <div className="max-w-4xl mx-auto flex items-center justify-around h-full px-4">
        <Link href={basePath}>
          <button className="flex flex-col items-center gap-0.5 text-gray-500 dark:text-white/60 hover:text-gray-900 dark:hover:text-white transition-colors" data-testid="nav-home">
            <Home className="h-5 w-5" />
            <span className="text-[10px] font-medium">Главная</span>
          </button>
        </Link>

        <button
          onClick={onToggleSearch}
          className={`flex flex-col items-center gap-0.5 transition-colors ${searchOpen ? "text-rose-400" : "text-gray-500 dark:text-white/60 hover:text-gray-900 dark:hover:text-white"}`}
          data-testid="nav-search"
        >
          <Search className="h-5 w-5" />
          <span className="text-[10px] font-medium">Поиск</span>
        </button>

        <button
          onClick={onToggleFavorites}
          className={`flex flex-col items-center gap-0.5 transition-colors relative ${showFavoritesOnly ? "text-rose-400" : "text-gray-500 dark:text-white/60 hover:text-gray-900 dark:hover:text-white"}`}
          data-testid="nav-favorites"
        >
          <Heart className={`h-5 w-5 ${showFavoritesOnly ? "fill-rose-400" : ""}`} />
          {favCount > 0 && (
            <span className="absolute -top-1 right-0 bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white text-[9px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">
              {favCount}
            </span>
          )}
          <span className="text-[10px] font-medium">Избранное</span>
        </button>

        <Link href={`${basePath}/cart`}>
          <button className="flex flex-col items-center gap-0.5 text-gray-500 dark:text-white/60 hover:text-gray-900 dark:hover:text-white transition-colors relative" data-testid="nav-cart">
            <ShoppingBag className="h-5 w-5" />
            {totalItems > 0 && (
              <span className="absolute -top-1 right-0 bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white text-[9px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">
                {totalItems}
              </span>
            )}
            <span className="text-[10px] font-medium">Корзина</span>
          </button>
        </Link>
      </div>
    </nav>
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
  const { toggleFavorite, isFavorite, count: favCount } = useFavorites(slug);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'feed' | 'grid'>(() => {
    try {
      const saved = localStorage.getItem(`fashion_view_${slug}`);
      return saved === 'feed' ? 'feed' : 'grid';
    } catch { return 'grid'; }
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTenantSlug(slug);
  }, [slug, setTenantSlug]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => {
      const next = prev === 'feed' ? 'grid' : 'feed';
      try { localStorage.setItem(`fashion_view_${slug}`, next); } catch {}
      return next;
    });
  }, [slug]);

  const activeProducts = useMemo(() => products.filter((p: any) => p.isActive), [products]);

  const filteredProducts = useMemo(() => {
    let result = activeProducts;
    if (showFavoritesOnly) {
      result = result.filter((p: any) => isFavorite(p.id));
    }
    if (selectedCategory) {
      result = result.filter((p: any) => p.categoryId === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((p: any) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }
    return result;
  }, [activeProducts, selectedCategory, searchQuery, showFavoritesOnly, isFavorite]);

  const newProducts = useMemo(() =>
    activeProducts.filter((p: any) => p.tags && p.tags.includes("new")).slice(0, 10),
    [activeProducts]
  );

  const hitProducts = useMemo(() =>
    activeProducts.filter((p: any) => p.tags && p.tags.includes("hit")).slice(0, 10),
    [activeProducts]
  );

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const cardHeight = container.clientHeight;
    if (cardHeight === 0) return;
    const idx = Math.round(container.scrollTop / cardHeight);
    setCurrentIndex(idx);
  }, []);

  const handleQuickAddToCart = useCallback((product: any) => {
    const productToAdd = { ...product, price: product.computedPrice || product.price };
    addItem(productToAdd);
    toast({
      title: "Добавлено в корзину",
      description: (
        <div className="flex items-center justify-between gap-4">
          <span className="truncate">{product.name}</span>
          <a href={`${basePath}/cart`} className="shrink-0 text-primary font-medium hover:underline">Оформить</a>
        </div>
      ),
    });
  }, [addItem, toast, basePath]);

  if (filteredProducts.length === 0 && !searchQuery && !selectedCategory) {
    return (
      <div className="max-w-md mx-auto bg-white dark:bg-black min-h-screen">
        <header className="sticky top-0 z-50 flex items-center justify-between gap-2 px-4 bg-white/80 dark:bg-black/80 backdrop-blur-md" style={{ height: HEADER_HEIGHT }}>
          <div className="flex items-center gap-2">
            {tenant?.logoUrl && <img src={resolveImageUrl(tenant.logoUrl)} alt={tenant.name} className="h-8 w-8 rounded-full object-cover border border-gray-300 dark:border-white/20" data-testid="img-tenant-logo" />}
            <span className="font-semibold text-gray-900 dark:text-white truncate" data-testid="text-tenant-name">{tenant?.name || slug}</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle variant="catalog" />
          </div>
        </header>
        <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400 dark:text-white/40 gap-4 p-8">
          <Package className="h-16 w-16" />
          <p className="text-lg font-medium">Товары не найдены</p>
        </div>
      </div>
    );
  }

  const headerContent = (
    <>
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/[0.04]">
        <div className="flex items-center justify-between gap-2 px-4" style={{ height: HEADER_HEIGHT }}>
          <div className="flex items-center gap-2.5">
            {tenant?.logoUrl && (
              <img src={resolveImageUrl(tenant.logoUrl)} alt={tenant.name} className="h-8 w-8 rounded-full object-cover border border-gray-300 dark:border-white/20 shadow-lg shadow-rose-500/10" data-testid="img-tenant-logo" />
            )}
            <span className="font-bold text-gray-900 dark:text-white truncate text-[15px]" data-testid="text-tenant-name">
              {tenant?.name || slug}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={toggleViewMode} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors" data-testid="button-toggle-view" title={viewMode === 'feed' ? 'Сетка' : 'Лента'}>
              {viewMode === 'feed' ? <LayoutGrid className="h-5 w-5 text-gray-600 dark:text-white/70" /> : <Rows3 className="h-5 w-5 text-gray-600 dark:text-white/70" />}
            </button>
            <ThemeToggle variant="catalog" />
          </div>
        </div>
        {(tenant?.contactPhone || tenant?.address || tenant?.workingHours) && (
          <div className="flex items-center gap-3 px-4 pb-2 text-[11px] text-gray-400 dark:text-white/50 overflow-x-auto">
            {tenant.contactPhone && (
              <a href={`tel:${tenant.contactPhone}`} className="flex items-center gap-1 shrink-0 hover:text-gray-600 dark:hover:text-white/70 transition-colors" data-testid="link-header-phone">
                <Phone className="h-3 w-3" />
                <span>{tenant.contactPhone}</span>
              </a>
            )}
            {tenant.address && (
              tenant.gisLink ? (
                <a href={tenant.gisLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 shrink-0 hover:text-gray-600 dark:hover:text-white/70 transition-colors" data-testid="link-header-address">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate max-w-[200px]">{tenant.address}</span>
                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                </a>
              ) : (
                <span className="flex items-center gap-1 shrink-0" data-testid="text-header-address">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate max-w-[200px]">{tenant.address}</span>
                </span>
              )
            )}
            {tenant.workingHours && (
              <span className="flex items-center gap-1 shrink-0" data-testid="text-header-hours">
                <Clock className="h-3 w-3" />
                <span>{tenant.workingHours}</span>
              </span>
            )}
          </div>
        )}
      </header>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="sticky z-45 bg-white/80 dark:bg-black/80 backdrop-blur-xl overflow-hidden"
            style={{ top: HEADER_HEIGHT }}
          >
            <div className="px-3 py-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-white/40" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск товаров..."
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/30 transition-all"
                  data-testid="input-search"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2" data-testid="button-clear-search">
                    <X className="h-4 w-4 text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        ref={categoryScrollRef}
        className="sticky z-40 flex items-center gap-2 px-3 overflow-x-auto scrollbar-hide bg-white/60 dark:bg-black/60 backdrop-blur-md"
        style={{ top: searchOpen ? HEADER_HEIGHT + 52 : HEADER_HEIGHT, height: CATEGORIES_HEIGHT, transition: "top 0.2s ease" }}
      >
        <button
          onClick={() => setSelectedCategory(null)}
          className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
            selectedCategory === null
              ? "bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white shadow-lg shadow-rose-500/25"
              : "bg-black/5 dark:bg-white/8 text-gray-500 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/15 hover:text-gray-700 dark:hover:text-white/80"
          }`}
          data-testid="button-category-all"
        >
          Все
        </button>
        {categories.map((cat: any) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              selectedCategory === cat.id
                ? "bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white shadow-lg shadow-rose-500/25"
                : "bg-black/5 dark:bg-white/8 text-gray-500 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/15 hover:text-gray-700 dark:hover:text-white/80"
            }`}
            data-testid={`button-category-${cat.id}`}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </>
  );

  if (viewMode === 'grid') {
    const showCarousels = !selectedCategory && !searchQuery;
    return (
      <div className="max-w-4xl mx-auto bg-white dark:bg-black min-h-screen relative">
        <style>{CSS_ANIMATIONS}</style>
        {headerContent}

        <div className="pb-20">
          {showCarousels && newProducts.length > 0 && (
            <div className="pt-3">
              <CarouselSection
                title="🔥 Новинки"
                products={newProducts}
                basePath={basePath}
                isFavorite={isFavorite}
                onToggleFavorite={toggleFavorite}
                onQuickAddToCart={handleQuickAddToCart}
              />
            </div>
          )}

          {showCarousels && hitProducts.length > 0 && (
            <CarouselSection
              title="⭐ Хиты продаж"
              products={hitProducts}
              basePath={basePath}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
              onQuickAddToCart={handleQuickAddToCart}
            />
          )}

          {showFavoritesOnly && filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-white/40 gap-3">
              <Heart className="h-12 w-12" />
              <p className="text-sm">У вас пока нет избранных товаров</p>
              <button onClick={() => setShowFavoritesOnly(false)} className="text-rose-400 text-sm hover:underline">Показать все товары</button>
            </div>
          ) : searchQuery && filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-white/40 gap-3">
              <Search className="h-12 w-12" />
              <p className="text-sm">Ничего не найдено по «{searchQuery}»</p>
              <button onClick={() => setSearchQuery("")} className="text-rose-400 text-sm hover:underline">Очистить поиск</button>
            </div>
          ) : selectedCategory && filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-white/40 gap-3">
              <Package className="h-12 w-12" />
              <p className="text-sm">В этой категории пока нет товаров</p>
              <button onClick={() => setSelectedCategory(null)} className="text-rose-400 text-sm hover:underline">Показать все</button>
            </div>
          ) : (
            <div className="px-2 py-3">
              {searchQuery && (
                <p className="text-gray-400 dark:text-white/40 text-xs px-1 mb-2">Найдено: {filteredProducts.length}</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                {filteredProducts.map((product: any, index: number) => (
                  <GridProductCard
                    key={product.id}
                    product={product}
                    basePath={basePath}
                    isFavorite={isFavorite(product.id)}
                    onToggleFavorite={toggleFavorite}
                    onQuickAddToCart={handleQuickAddToCart}
                    index={index}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <BottomNavBar
          basePath={basePath}
          totalItems={totalItems}
          favCount={favCount}
          searchOpen={searchOpen}
          showFavoritesOnly={showFavoritesOnly}
          onToggleSearch={() => setSearchOpen(!searchOpen)}
          onToggleFavorites={() => setShowFavoritesOnly(!showFavoritesOnly)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-black min-h-screen relative">
      <style>{CSS_ANIMATIONS}</style>
      {headerContent}

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="overflow-y-auto snap-y snap-mandatory"
        style={{ height: `calc(100vh - ${TOTAL_TOP + BOTTOM_NAV_HEIGHT}px)` }}
      >
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-white/40 gap-3">
            <Search className="h-12 w-12" />
            <p className="text-sm">{searchQuery ? `Ничего не найдено по «${searchQuery}»` : "Товары не найдены"}</p>
          </div>
        ) : (
          filteredProducts.map((product: any, index: number) => {
            const imageUrl = resolveImageUrl(product.mainImageUrl);
            const viewers = getViewerCount(product.id);
            const favorite = isFavorite(product.id);

            return (
              <div
                key={product.id}
                className="snap-start snap-always relative"
                style={{ height: `calc(100vh - ${TOTAL_TOP + BOTTOM_NAV_HEIGHT}px)` }}
                data-testid={`card-product-${product.id}`}
              >
                <div className="absolute inset-0 bg-white dark:bg-black">
                  {(product as any).videoUrl && (product as any).videoPrimary ? (
                    <video
                      src={resolveImageUrl((product as any).videoUrl)}
                      poster={resolveImageUrl((product as any).videoPosterUrl || product.mainImageUrl)}
                      autoPlay muted loop playsInline
                      className="w-full h-full object-contain bg-white dark:bg-black"
                      data-testid={`video-product-${product.id}`}
                    />
                  ) : imageUrl ? (
                    <img src={imageUrl} alt={product.name} className="w-full h-full object-contain p-1" loading={index < 2 ? "eager" : "lazy"} data-testid={`img-product-${product.id}`} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-neutral-900">
                      <Package className="h-20 w-20 text-gray-400 dark:text-neutral-700" />
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
                        <span key={tag} className={`bg-gradient-to-r ${config.gradient} text-white text-xs font-semibold px-2.5 py-0.5 rounded-md shadow-lg`} data-testid={`badge-tag-${tag}-${product.id}`}>
                          {config.label}
                        </span>
                      );
                    })}
                    {product.hasDiscount && product.discountPercent && (
                      <span className="bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white text-xs font-semibold px-2.5 py-0.5 rounded-md shadow-lg shadow-rose-500/30" data-testid={`badge-discount-${product.id}`} style={{ animation: "glowPulse 2s infinite" }}>
                        -{Math.round(product.discountPercent)}%
                      </span>
                    )}
                  </div>
                )}

                <div className="absolute right-3 bottom-1/3 flex flex-col items-center gap-4 z-10">
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      try {
                        const url = `${window.location.origin}${basePath}/product/${product.id}`;
                        if (navigator.share) { await navigator.share({ title: product.name, url }); }
                        else { await navigator.clipboard.writeText(url); }
                      } catch {}
                    }}
                    className="flex flex-col items-center gap-1"
                    data-testid={`button-share-feed-${product.id}`}
                  >
                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/[0.08]">
                      <Share2 className="h-5 w-5 text-white" />
                    </div>
                  </button>

                  <button
                    onClick={() => handleQuickAddToCart(product)}
                    className="relative flex flex-col items-center gap-1"
                    data-testid={`button-cart-${product.id}`}
                  >
                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/[0.08]">
                      <ShoppingBag className="h-5 w-5 text-white" />
                    </div>
                    {totalItems > 0 && (
                      <span className="absolute -top-1 -right-1 bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg" data-testid="badge-cart-count-overlay">
                        {totalItems}
                      </span>
                    )}
                  </button>

                  <button onClick={() => toggleFavorite(product.id)} className="flex flex-col items-center gap-1" data-testid={`button-favorite-${product.id}`}>
                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/[0.08]">
                      <Heart className={`h-5 w-5 transition-all ${favorite ? "text-rose-500 fill-rose-500" : "text-white"}`} style={favorite ? { animation: "heartBounce 0.6s ease-in-out" } : undefined} />
                    </div>
                  </button>
                </div>

                <div className="absolute bottom-0 left-0 right-16 p-4 z-10">
                  <Link href={`${basePath}/product/${product.id}`}>
                    <h2 className="text-white text-xl font-bold mb-2 line-clamp-2 cursor-pointer" data-testid={`text-product-name-${product.id}`}>
                      {product.name}
                    </h2>
                  </Link>

                  {product.brand && (
                    <span className="inline-block bg-white/15 text-white/80 text-xs px-2 py-0.5 rounded-md mb-2 backdrop-blur-sm" data-testid={`badge-brand-${product.id}`}>
                      {product.brand}
                    </span>
                  )}

                  <div className="flex items-center gap-3 mb-3">
                    {product.hasDiscount ? (
                      <>
                        <span className="text-2xl font-extrabold bg-gradient-to-r from-rose-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent" data-testid={`text-price-${product.id}`}>
                          {formatPrice(product.computedPrice)}
                        </span>
                        <span className="text-white/40 text-base line-through" data-testid={`text-original-price-${product.id}`}>
                          {formatPrice(product.originalPrice)}
                        </span>
                      </>
                    ) : (
                      <span className="text-white text-2xl font-bold" data-testid={`text-price-${product.id}`}>
                        {formatPrice(product.computedPrice || product.price)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-white/40 text-xs">
                    <Flame className="h-3 w-3 text-rose-400/60" />
                    <span data-testid={`text-viewers-${product.id}`}>{viewers} человек смотрят</span>
                  </div>
                </div>

                {filteredProducts.length > 1 && (
                  <div className="absolute right-3 top-4 z-10">
                    <span className="text-white/50 text-xs font-medium bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full border border-white/[0.06]">
                      {index + 1} / {filteredProducts.length}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <BottomNavBar
        basePath={basePath}
        totalItems={totalItems}
        favCount={favCount}
        searchOpen={searchOpen}
        showFavoritesOnly={showFavoritesOnly}
        onToggleSearch={() => setSearchOpen(!searchOpen)}
        onToggleFavorites={() => setShowFavoritesOnly(!showFavoritesOnly)}
      />
    </div>
  );
}
