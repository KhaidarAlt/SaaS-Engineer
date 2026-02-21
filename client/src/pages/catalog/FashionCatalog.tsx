import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Sparkles,
  Ruler,
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
  Shirt,
  Palette,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
        <h2 className="text-white font-bold text-base">{title}</h2>
        <span className="text-white/40 text-xs flex items-center gap-0.5">
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
              <div className="rounded-2xl overflow-hidden bg-neutral-900/70 backdrop-blur border border-white/[0.06]">
                <Link href={`${basePath}/product/${product.id}`}>
                  <div className="aspect-[4/5] relative overflow-hidden group cursor-pointer">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                        <Package className="h-8 w-8 text-neutral-600" />
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
                  <p className="text-white/90 text-xs font-medium line-clamp-1">{product.name}</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-sm font-bold ${product.hasDiscount ? "bg-gradient-to-r from-rose-400 to-fuchsia-400 bg-clip-text text-transparent" : "text-white"}`}>
                      {formatPrice(product.computedPrice || product.price)}
                    </span>
                    {product.hasDiscount && (
                      <span className="text-white/30 text-[10px] line-through">{formatPrice(product.originalPrice)}</span>
                    )}
                  </div>
                  <button
                    onClick={() => onQuickAddToCart(product)}
                    className="w-full mt-1 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
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
  onOpenSizes,
  onOpenStylist,
  index,
}: {
  product: any;
  basePath: string;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onQuickAddToCart: (product: any) => void;
  onOpenSizes: (product: any) => void;
  onOpenStylist: (product: any) => void;
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
      <div className="rounded-2xl overflow-hidden bg-neutral-900/70 backdrop-blur-xl border border-white/[0.06] shadow-xl shadow-black/30 transition-transform duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-rose-500/10">
        <Link href={`${basePath}/product/${product.id}`}>
          <div className="aspect-[4/5] relative overflow-hidden cursor-pointer group">
            {(product as any).videoUrl && (product as any).videoPrimary ? (
              <video
                src={resolveImageUrl((product as any).videoUrl)}
                poster={resolveImageUrl((product as any).videoPosterUrl || product.mainImageUrl)}
                autoPlay muted loop playsInline
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                data-testid={`video-product-${product.id}`}
              />
            ) : imageUrl ? (
              <>
                <img
                  src={imageUrl}
                  alt={product.name}
                  className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-110 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                  loading="lazy"
                  onLoad={() => setImgLoaded(true)}
                  data-testid={`img-product-${product.id}`}
                />
                {!imgLoaded && (
                  <div className="absolute inset-0 bg-neutral-800" style={{
                    background: "linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%)",
                    backgroundSize: "200% 100%",
                    animation: "shimmer 1.5s infinite"
                  }} />
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                <Package className="h-12 w-12 text-neutral-600" />
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
                  className="w-3.5 h-3.5 rounded-full border border-white/15 shrink-0 ring-1 ring-black/30"
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                />
              ))}
              {product.colors.length > 5 && (
                <span className="text-[10px] text-white/30 ml-0.5">+{product.colors.length - 5}</span>
              )}
            </div>
          )}

          <Link href={`${basePath}/product/${product.id}`}>
            <h3 className="text-white font-semibold text-sm line-clamp-2 cursor-pointer leading-snug hover:text-rose-200 transition-colors" data-testid={`text-product-name-${product.id}`}>
              {product.name}
            </h3>
          </Link>

          {product.brand && (
            <span className="text-white/35 text-[11px] block" data-testid={`badge-brand-${product.id}`}>
              {product.brand}
            </span>
          )}

          <div className="flex items-baseline gap-2">
            {product.hasDiscount ? (
              <>
                <span className="font-extrabold text-[15px] bg-gradient-to-r from-rose-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent" data-testid={`text-price-${product.id}`}>
                  {formatPrice(product.computedPrice)}
                </span>
                <span className="text-white/25 text-xs line-through" data-testid={`text-original-price-${product.id}`}>
                  {formatPrice(product.originalPrice)}
                </span>
              </>
            ) : (
              <span className="text-white font-bold text-[15px]" data-testid={`text-price-${product.id}`}>
                {formatPrice(product.computedPrice || product.price)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 text-[11px] text-white/35">
            <span className="flex items-center gap-0.5" data-testid={`text-purchases-${product.id}`}>
              <ShoppingBag className="h-3 w-3 text-emerald-400/60" />
              Купили {purchaseCount} раз
            </span>
            <span className="flex items-center gap-0.5" data-testid={`text-viewers-${product.id}`}>
              <Flame className="h-3 w-3 text-rose-400/60" />
              {viewers}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1.5 border-t border-white/[0.05]">
            <div className="flex items-center gap-0.5">
              <button onClick={handleFavorite} className="p-1.5 rounded-full hover:bg-white/10 transition-colors" data-testid={`button-favorite-grid-${product.id}`}>
                <Heart className={`h-4 w-4 transition-all ${isFavorite ? "text-rose-500 fill-rose-500" : "text-white/50 hover:text-white/80"}`} />
              </button>
              <button onClick={handleAddCart} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
                <ShoppingBag className={`h-4 w-4 text-white/50 hover:text-white/80 transition-all`} style={bagAnim ? { animation: "bagPulse 0.4s ease-in-out" } : undefined} />
              </button>
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenStylist(product); }} className="p-1.5 rounded-full hover:bg-white/10 transition-colors" data-testid={`button-stylist-grid-${product.id}`}>
                <Sparkles className="h-4 w-4 text-white/50 hover:text-violet-400 transition-colors" />
              </button>
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenSizes(product); }} className="p-1.5 rounded-full hover:bg-white/10 transition-colors" data-testid={`button-sizes-grid-${product.id}`}>
                <Ruler className="h-4 w-4 text-white/50 hover:text-white/80 transition-colors" />
              </button>
            </div>
            <button onClick={handleShare} className="p-1.5 rounded-full hover:bg-white/10 transition-colors" data-testid={`button-share-${product.id}`}>
              <Share2 className="h-4 w-4 text-white/50 hover:text-white/80 transition-colors" />
            </button>
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
      className="fixed bottom-0 left-0 right-0 z-50 bg-black/70 backdrop-blur-xl border-t border-white/[0.06]"
      style={{ height: BOTTOM_NAV_HEIGHT }}
      data-testid="nav-bottom-bar"
    >
      <div className="max-w-4xl mx-auto flex items-center justify-around h-full px-4">
        <Link href={basePath}>
          <button className="flex flex-col items-center gap-0.5 text-white/60 hover:text-white transition-colors" data-testid="nav-home">
            <Home className="h-5 w-5" />
            <span className="text-[10px] font-medium">Главная</span>
          </button>
        </Link>

        <button
          onClick={onToggleSearch}
          className={`flex flex-col items-center gap-0.5 transition-colors ${searchOpen ? "text-rose-400" : "text-white/60 hover:text-white"}`}
          data-testid="nav-search"
        >
          <Search className="h-5 w-5" />
          <span className="text-[10px] font-medium">Поиск</span>
        </button>

        <button
          onClick={onToggleFavorites}
          className={`flex flex-col items-center gap-0.5 transition-colors relative ${showFavoritesOnly ? "text-rose-400" : "text-white/60 hover:text-white"}`}
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
          <button className="flex flex-col items-center gap-0.5 text-white/60 hover:text-white transition-colors relative" data-testid="nav-cart">
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
  const [sizeSheetOpen, setSizeSheetOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<any | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [stylistSheetOpen, setStylistSheetOpen] = useState(false);
  const [stylistProduct, setStylistProduct] = useState<any | null>(null);
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

  const openSizeSheet = useCallback((product: any) => {
    setActiveProduct(product);
    setSelectedSize(null);
    setSelectedColor(null);
    setSizeSheetOpen(true);
  }, []);

  const openStylistSheet = useCallback((product: any) => {
    setStylistProduct(product);
    setStylistSheetOpen(true);
  }, []);

  const handleAddToCart = useCallback(() => {
    if (!activeProduct) return;
    if (activeProduct.sizes && activeProduct.sizes.length > 0 && !selectedSize) {
      toast({ title: "Выберите размер", description: "Для добавления в корзину необходимо выбрать размер", variant: "destructive" });
      return;
    }
    const productToAdd = { ...activeProduct, price: activeProduct.computedPrice || activeProduct.price };
    addItem(productToAdd);
    toast({
      title: "Добавлено в корзину",
      description: (
        <div className="flex items-center justify-between gap-4">
          <span className="truncate">{activeProduct.name}{selectedSize ? ` (${selectedSize})` : ""}{selectedColor ? ` — ${selectedColor}` : ""}</span>
          <a href={`${basePath}/cart`} className="shrink-0 text-primary font-medium hover:underline">Оформить</a>
        </div>
      ),
    });
    setSizeSheetOpen(false);
    setActiveProduct(null);
    setSelectedSize(null);
    setSelectedColor(null);
  }, [activeProduct, selectedSize, selectedColor, addItem, toast, basePath]);

  const handleQuickAddToCart = useCallback((product: any) => {
    if (product.sizes && product.sizes.length > 0) {
      openSizeSheet(product);
      return;
    }
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
  }, [addItem, toast, basePath, openSizeSheet]);

  const getAvailableColors = useCallback(() => {
    if (!activeProduct) return [];
    if (!selectedSize || !activeProduct.sizeColorStock) {
      return activeProduct.colors || [];
    }
    const availableHexes = activeProduct.sizeColorStock
      .filter((sc: any) => sc.size === selectedSize && sc.qty > 0)
      .map((sc: any) => sc.colorHex || sc.color);
    if (availableHexes.length === 0) return activeProduct.colors || [];
    return (activeProduct.colors || []).filter((c: any) => availableHexes.includes(c.hex));
  }, [activeProduct, selectedSize]);

  if (filteredProducts.length === 0 && !searchQuery && !selectedCategory) {
    return (
      <div className="max-w-md mx-auto bg-black min-h-screen">
        <header className="sticky top-0 z-50 flex items-center justify-between gap-2 px-4 bg-black/80 backdrop-blur-md" style={{ height: HEADER_HEIGHT }}>
          <div className="flex items-center gap-2">
            {tenant?.logoUrl && <img src={resolveImageUrl(tenant.logoUrl)} alt={tenant.name} className="h-8 w-8 rounded-full object-cover border border-white/20" data-testid="img-tenant-logo" />}
            <span className="font-semibold text-white truncate" data-testid="text-tenant-name">{tenant?.name || slug}</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
          </div>
        </header>
        <div className="flex flex-col items-center justify-center h-[60vh] text-white/40 gap-4 p-8">
          <Package className="h-16 w-16" />
          <p className="text-lg font-medium">Товары не найдены</p>
        </div>
      </div>
    );
  }

  const headerContent = (
    <>
      <header className="sticky top-0 z-50 flex items-center justify-between gap-2 px-4 bg-black/80 backdrop-blur-xl border-b border-white/[0.04]" style={{ height: HEADER_HEIGHT }}>
        <div className="flex items-center gap-2.5">
          {tenant?.logoUrl && (
            <img src={resolveImageUrl(tenant.logoUrl)} alt={tenant.name} className="h-8 w-8 rounded-full object-cover border border-white/20 shadow-lg shadow-rose-500/10" data-testid="img-tenant-logo" />
          )}
          <span className="font-bold text-white truncate text-[15px]" data-testid="text-tenant-name">
            {tenant?.name || slug}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={toggleViewMode} className="p-2 rounded-xl hover:bg-white/10 transition-colors" data-testid="button-toggle-view" title={viewMode === 'feed' ? 'Сетка' : 'Лента'}>
            {viewMode === 'feed' ? <LayoutGrid className="h-5 w-5 text-white/70" /> : <Rows3 className="h-5 w-5 text-white/70" />}
          </button>
          <ThemeToggle />
        </div>
      </header>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="sticky z-45 bg-black/80 backdrop-blur-xl overflow-hidden"
            style={{ top: HEADER_HEIGHT }}
          >
            <div className="px-3 py-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск товаров..."
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white/10 border border-white/[0.08] text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/30 transition-all"
                  data-testid="input-search"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2" data-testid="button-clear-search">
                    <X className="h-4 w-4 text-white/40 hover:text-white/70" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        ref={categoryScrollRef}
        className="sticky z-40 flex items-center gap-2 px-3 overflow-x-auto scrollbar-hide bg-black/60 backdrop-blur-md"
        style={{ top: searchOpen ? HEADER_HEIGHT + 52 : HEADER_HEIGHT, height: CATEGORIES_HEIGHT, transition: "top 0.2s ease" }}
      >
        <button
          onClick={() => setSelectedCategory(null)}
          className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
            selectedCategory === null
              ? "bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white shadow-lg shadow-rose-500/25"
              : "bg-white/8 text-white/60 hover:bg-white/15 hover:text-white/80"
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
                : "bg-white/8 text-white/60 hover:bg-white/15 hover:text-white/80"
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
      <SheetContent side="bottom" className="rounded-t-3xl max-w-md mx-auto bg-neutral-950 border-white/[0.06]">
        <SheetHeader>
          <SheetTitle className="text-white">{activeProduct?.name || "Выберите размер"}</SheetTitle>
          <SheetDescription className="text-white/50">Выберите размер и цвет для добавления в корзину</SheetDescription>
        </SheetHeader>
        {activeProduct && (
          <div className="mt-4 space-y-6">
            <div className="flex items-center gap-3">
              {activeProduct.mainImageUrl && (
                <img src={resolveImageUrl(activeProduct.mainImageUrl)} alt={activeProduct.name} className="w-16 h-16 rounded-xl object-cover border border-white/10" />
              )}
              <div>
                <p className="font-semibold text-white">{activeProduct.name}</p>
                <div className="flex items-center gap-2">
                  {activeProduct.hasDiscount ? (
                    <>
                      <span className="text-lg font-bold bg-gradient-to-r from-rose-400 to-fuchsia-400 bg-clip-text text-transparent">{formatPrice(activeProduct.computedPrice)}</span>
                      <span className="text-sm text-white/30 line-through">{formatPrice(activeProduct.originalPrice)}</span>
                    </>
                  ) : (
                    <span className="text-lg font-bold text-white">{formatPrice(activeProduct.computedPrice || activeProduct.price)}</span>
                  )}
                </div>
              </div>
            </div>

            {activeProduct.sizes && activeProduct.sizes.length > 0 && (
              <div>
                <p className="text-sm font-medium text-white/80 mb-2">Размер</p>
                <div className="flex flex-wrap gap-2">
                  {activeProduct.sizes.map((s: { size: string; qty: number }) => {
                    const isAvailable = activeProduct.alwaysInStock || s.qty > 0;
                    const isSelected = selectedSize === s.size;
                    return (
                      <button
                        key={s.size}
                        disabled={!isAvailable}
                        onClick={() => { setSelectedSize(isSelected ? null : s.size); setSelectedColor(null); }}
                        className={`min-w-[48px] px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                          isSelected
                            ? "bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white border-transparent shadow-lg shadow-rose-500/25"
                            : isAvailable
                              ? "bg-white/10 text-white/80 border-white/[0.06] hover:bg-white/15"
                              : "bg-white/5 text-white/20 border-transparent cursor-not-allowed line-through"
                        }`}
                        data-testid={`button-size-${s.size}`}
                      >
                        {s.size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeProduct.colors && activeProduct.colors.length > 0 && (
              <div>
                <p className="text-sm font-medium text-white/80 mb-2">
                  Цвет {selectedColor && <span className="ml-2 text-white/40 font-normal">— {selectedColor}</span>}
                </p>
                <div className="flex flex-wrap gap-3">
                  {getAvailableColors().map((c: { name: string; hex: string }) => {
                    const isSelected = selectedColor === c.name;
                    return (
                      <button
                        key={c.hex}
                        onClick={() => setSelectedColor(isSelected ? null : c.name)}
                        className={`w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center ${isSelected ? "border-rose-400 scale-110 shadow-lg shadow-rose-500/20" : "border-transparent"}`}
                        title={c.name}
                        data-testid={`button-color-${c.name}`}
                      >
                        <span className="w-7 h-7 rounded-full block border border-white/10" style={{ backgroundColor: c.hex }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Button
              className="w-full bg-gradient-to-r from-rose-500 to-fuchsia-500 hover:from-rose-600 hover:to-fuchsia-600 text-white font-semibold shadow-lg shadow-rose-500/25 border-0"
              size="lg"
              onClick={handleAddToCart}
              disabled={activeProduct.sizes && activeProduct.sizes.length > 0 && !selectedSize}
              data-testid="button-add-to-cart"
            >
              <ShoppingBag className="h-4 w-4 mr-2" />
              В корзину
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );

  const getStylistTips = (product: any) => {
    const tips: { icon: any; title: string; text: string }[] = [];
    if (product.colors && product.colors.length > 0) {
      const colorNames = product.colors.slice(0, 3).map((c: any) => c.name).join(", ");
      tips.push({ icon: Palette, title: "Цветовые сочетания", text: `${colorNames} — отлично сочетаются с нейтральными тонами: белым, бежевым и серым.` });
    }
    if (product.tags?.includes("new")) {
      tips.push({ icon: Sparkles, title: "Трендовая модель", text: "Эта модель в тренде! Сочетайте с минималистичными аксессуарами для актуального образа." });
    }
    if (product.tags?.includes("hit")) {
      tips.push({ icon: Flame, title: "Выбор покупателей", text: "Бестселлер сезона. Универсальная модель, которая подходит для любого случая." });
    }
    tips.push({ icon: Shirt, title: "Совет стилиста", text: "Для создания стильного повседневного образа сочетайте с джинсами или брюками свободного кроя." });
    tips.push({ icon: Wand2, title: "Как носить", text: "Дополните образ аксессуарами — сумкой в тон или контрастным шарфом для эффектного акцента." });
    return tips;
  };

  const stylistSheet = (
    <Sheet open={stylistSheetOpen} onOpenChange={setStylistSheetOpen}>
      <SheetContent side="bottom" className="rounded-t-3xl max-w-md mx-auto bg-neutral-950 border-white/[0.06]">
        <SheetHeader>
          <SheetTitle className="text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-400" />
            ИИ Стилист
          </SheetTitle>
          <SheetDescription className="text-white/50">Рекомендации по стилю для этого товара</SheetDescription>
        </SheetHeader>
        {stylistProduct && (
          <div className="mt-4 space-y-5">
            <div className="flex items-center gap-3">
              {stylistProduct.mainImageUrl && (
                <img src={resolveImageUrl(stylistProduct.mainImageUrl)} alt={stylistProduct.name} className="w-16 h-20 rounded-xl object-cover border border-white/10" />
              )}
              <div>
                <p className="font-semibold text-white text-sm">{stylistProduct.name}</p>
                {stylistProduct.brand && <p className="text-white/40 text-xs">{stylistProduct.brand}</p>}
                <p className="text-sm font-bold mt-1 bg-gradient-to-r from-rose-400 to-fuchsia-400 bg-clip-text text-transparent">
                  {formatPrice(stylistProduct.computedPrice || stylistProduct.price)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {getStylistTips(stylistProduct).map((tip, i) => {
                const IconComp = tip.icon;
                return (
                  <div key={i} className="flex gap-3 p-3 rounded-xl bg-white/5 border border-white/[0.06]">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center shrink-0">
                      <IconComp className="h-4 w-4 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-white text-xs font-semibold mb-0.5">{tip.title}</p>
                      <p className="text-white/50 text-xs leading-relaxed">{tip.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button
              className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white font-semibold shadow-lg shadow-violet-500/25 border-0"
              size="lg"
              onClick={() => { handleQuickAddToCart(stylistProduct); setStylistSheetOpen(false); }}
              data-testid="button-stylist-add-cart"
            >
              <ShoppingBag className="h-4 w-4 mr-2" />
              Добавить в корзину
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );

  if (viewMode === 'grid') {
    const showCarousels = !selectedCategory && !searchQuery;
    return (
      <div className="max-w-4xl mx-auto bg-black min-h-screen relative">
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
            <div className="flex flex-col items-center justify-center py-20 text-white/40 gap-3">
              <Heart className="h-12 w-12" />
              <p className="text-sm">У вас пока нет избранных товаров</p>
              <button onClick={() => setShowFavoritesOnly(false)} className="text-rose-400 text-sm hover:underline">Показать все товары</button>
            </div>
          ) : searchQuery && filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/40 gap-3">
              <Search className="h-12 w-12" />
              <p className="text-sm">Ничего не найдено по «{searchQuery}»</p>
              <button onClick={() => setSearchQuery("")} className="text-rose-400 text-sm hover:underline">Очистить поиск</button>
            </div>
          ) : selectedCategory && filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/40 gap-3">
              <Package className="h-12 w-12" />
              <p className="text-sm">В этой категории пока нет товаров</p>
              <button onClick={() => setSelectedCategory(null)} className="text-rose-400 text-sm hover:underline">Показать все</button>
            </div>
          ) : (
            <div className="px-2 py-3">
              {searchQuery && (
                <p className="text-white/40 text-xs px-1 mb-2">Найдено: {filteredProducts.length}</p>
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
                    onOpenSizes={openSizeSheet}
                    onOpenStylist={openStylistSheet}
                    index={index}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {sizeSheet}
        {stylistSheet}

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
    <div className="max-w-md mx-auto bg-black min-h-screen relative">
      <style>{CSS_ANIMATIONS}</style>
      {headerContent}

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="overflow-y-auto snap-y snap-mandatory"
        style={{ height: `calc(100vh - ${TOTAL_TOP + BOTTOM_NAV_HEIGHT}px)` }}
      >
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/40 gap-3">
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
                <div className="absolute inset-0 bg-black">
                  {(product as any).videoUrl && (product as any).videoPrimary ? (
                    <video
                      src={resolveImageUrl((product as any).videoUrl)}
                      poster={resolveImageUrl((product as any).videoPosterUrl || product.mainImageUrl)}
                      autoPlay muted loop playsInline
                      className="w-full h-full object-contain bg-black"
                      data-testid={`video-product-${product.id}`}
                    />
                  ) : imageUrl ? (
                    <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" loading={index < 2 ? "eager" : "lazy"} data-testid={`img-product-${product.id}`} />
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

                  <button onClick={() => openStylistSheet(product)} className="flex flex-col items-center gap-1" data-testid="button-ai-stylist">
                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/[0.08]">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-white/70 text-[10px] font-medium">Стилист</span>
                  </button>

                  <button onClick={() => openSizeSheet(product)} className="flex flex-col items-center gap-1" data-testid={`button-sizes-${product.id}`}>
                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/[0.08]">
                      <Ruler className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-white/70 text-[10px] font-medium">Размеры</span>
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

      {sizeSheet}
      {stylistSheet}

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
