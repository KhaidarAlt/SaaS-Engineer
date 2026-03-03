import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  Plus,
  Minus,
  Clock,
  Flame,
  AlertTriangle,
  ChefHat,
  MessageSquare,
  X,
  Check,
  Package,
  Percent,
  Star,
  TrendingUp,
  Sparkles,
  Leaf,
  Baby,
  Wheat,
  Timer,
  Truck,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { resolveImageUrl } from "@/lib/imageUrl";
import type { Product } from "@shared/schema";

interface FoodCatalogProps {
  slug: string;
  basePath: string;
  tenant: any;
  products: any[];
  categories: any[];
}

const TAG_CONFIG: Record<string, { label: string; icon: any; bg: string; text: string; type: "marketing" | "info" | "urgency" }> = {
  hit: { label: "Хит продаж", icon: TrendingUp, bg: "bg-gradient-to-r from-amber-500 to-orange-500", text: "text-white", type: "marketing" },
  new: { label: "Новинка", icon: Sparkles, bg: "bg-gradient-to-r from-blue-500 to-indigo-500", text: "text-white", type: "marketing" },
  popular: { label: "Популярно", icon: Star, bg: "bg-gradient-to-r from-purple-500 to-pink-500", text: "text-white", type: "marketing" },
  best_price: { label: "Лучшая цена", icon: TrendingUp, bg: "bg-gradient-to-r from-emerald-500 to-teal-500", text: "text-white", type: "marketing" },
  sale: { label: "Скидка", icon: Percent, bg: "bg-gradient-to-r from-rose-500 to-red-500", text: "text-white", type: "urgency" },
  vegan: { label: "Веган", icon: Leaf, bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300", type: "info" },
  spicy: { label: "Остро", icon: Flame, bg: "bg-orange-100 dark:bg-orange-900/40", text: "text-orange-700 dark:text-orange-300", type: "info" },
  gluten_free: { label: "Без глютена", icon: Wheat, bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300", type: "info" },
  kids: { label: "Детское", icon: Baby, bg: "bg-sky-100 dark:bg-sky-900/40", text: "text-sky-700 dark:text-sky-300", type: "info" },
  low_stock: { label: "Осталось мало", icon: Timer, bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300", type: "urgency" },
  today: { label: "Доставка сегодня", icon: Truck, bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-700 dark:text-green-300", type: "urgency" },
};

function formatPrice(value: number | string) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("ru-KZ").format(num) + " \u20B8";
}

const HEADER_HEIGHT = 60;
const CATEGORIES_HEIGHT = 52;

interface LastOrderItem {
  id: string;
  name: string;
  price: string;
  mainImageUrl?: string | null;
}

function ImageWithSkeleton({ src, alt, className, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="relative w-full h-full">
      {!loaded && !error && (
        <div className="absolute inset-0 bg-muted animate-pulse rounded-inherit" />
      )}
      {error ? (
        <div className="absolute inset-0 bg-muted flex items-center justify-center">
          <ChefHat className="h-10 w-10 text-muted-foreground/30" />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className={`${className} transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          loading="lazy"
          {...props}
        />
      )}
    </div>
  );
}

export default function FoodCatalog({
  slug,
  basePath,
  tenant,
  products,
  categories,
}: FoodCatalogProps) {
  const { addItem, removeItem, updateQuantity, totalItems, subtotal, setTenantSlug, items } = useCart();
  const { toast } = useToast();

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [modifierSheetOpen, setModifierSheetOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<any | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [kitchenComment, setKitchenComment] = useState("");
  const [isScrollingByClick, setIsScrollingByClick] = useState(false);
  const isScrollingByClickRef = useRef(false);
  const [addedProductId, setAddedProductId] = useState<string | null>(null);

  const categoryTabsRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const categoryButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const lastOrderKey = `last_order_${slug}`;

  useEffect(() => {
    setTenantSlug(slug);
  }, [slug, setTenantSlug]);

  useEffect(() => {
    if (items.length > 0) {
      const orderItems: LastOrderItem[] = items.slice(0, 6).map((ci) => ({
        id: ci.product.id,
        name: ci.product.name,
        price: ci.product.price,
        mainImageUrl: ci.product.mainImageUrl,
      }));
      try {
        localStorage.setItem(lastOrderKey, JSON.stringify(orderItems));
      } catch {}
    }
  }, [items, lastOrderKey]);

  const lastOrder = useMemo<LastOrderItem[]>(() => {
    try {
      const stored = localStorage.getItem(lastOrderKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, [lastOrderKey]);

  const activeProducts = useMemo(
    () => products.filter((p: any) => p.isActive),
    [products],
  );

  const activeCategories = useMemo(() => {
    const catIdsWithProducts = new Set(activeProducts.map((p: any) => p.categoryId));
    return categories.filter((c: any) => c.isActive && catIdsWithProducts.has(c.id));
  }, [categories, activeProducts]);

  const productsByCategory = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const cat of activeCategories) {
      map[cat.id] = activeProducts.filter((p: any) => p.categoryId === cat.id);
    }
    const uncategorized = activeProducts.filter(
      (p: any) => !p.categoryId || !activeCategories.find((c: any) => c.id === p.categoryId),
    );
    if (uncategorized.length > 0) {
      map["__uncategorized"] = uncategorized;
    }
    return map;
  }, [activeProducts, activeCategories]);

  const allSectionIds = useMemo(() => {
    const ids = activeCategories.map((c: any) => c.id);
    if (productsByCategory["__uncategorized"]) {
      ids.push("__uncategorized");
    }
    return ids;
  }, [activeCategories, productsByCategory]);

  useEffect(() => {
    if (allSectionIds.length > 0 && !activeCategoryId) {
      setActiveCategoryId(allSectionIds[0]);
    }
  }, [allSectionIds, activeCategoryId]);

  useEffect(() => {
    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      if (isScrollingByClickRef.current) return;

      let topMostId: string | null = null;
      let topMostTop = Infinity;

      for (const entry of entries) {
        if (entry.isIntersecting) {
          const rect = entry.boundingClientRect;
          if (rect.top < topMostTop) {
            topMostTop = rect.top;
            topMostId = entry.target.getAttribute("data-section-id");
          }
        }
      }

      if (topMostId) {
        setActiveCategoryId(topMostId);
      }
    };

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: `-${HEADER_HEIGHT + CATEGORIES_HEIGHT + 8}px 0px -60% 0px`,
      threshold: 0,
    });

    for (const id of allSectionIds) {
      const el = sectionRefs.current[id];
      if (el) {
        observer.observe(el);
      }
    }

    return () => {
      observer.disconnect();
    };
  }, [allSectionIds]);

  useEffect(() => {
    if (activeCategoryId && categoryButtonRefs.current[activeCategoryId] && categoryTabsRef.current) {
      const btn = categoryButtonRefs.current[activeCategoryId];
      const container = categoryTabsRef.current;
      if (btn && container) {
        const scrollLeft = btn.offsetLeft - container.offsetWidth / 2 + btn.offsetWidth / 2;
        container.scrollTo({ left: scrollLeft, behavior: "smooth" });
      }
    }
  }, [activeCategoryId]);

  const scrollToSection = useCallback((categoryId: string) => {
    isScrollingByClickRef.current = true;
    setIsScrollingByClick(true);
    setActiveCategoryId(categoryId);
    const el = sectionRefs.current[categoryId];
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT - CATEGORIES_HEIGHT - 8;
      window.scrollTo({ top, behavior: "smooth" });
    }
    setTimeout(() => {
      isScrollingByClickRef.current = false;
      setIsScrollingByClick(false);
    }, 1000);
  }, []);

  const openModifierSheet = useCallback((product: any) => {
    setActiveProduct(product);
    setSelectedModifiers({});
    setQuantity(1);
    setKitchenComment("");
    setModifierSheetOpen(true);
  }, []);

  const handleQuickAdd = useCallback(
    (product: any) => {
      if (product.modifiers && product.modifiers.length > 0) {
        openModifierSheet(product);
        return;
      }
      const productToAdd = {
        ...product,
        price: product.computedPrice || product.price,
      };
      addItem(productToAdd);
      setAddedProductId(product.id);
      setTimeout(() => setAddedProductId(null), 600);
    },
    [addItem, openModifierSheet],
  );

  const getItemQuantity = useCallback(
    (productId: string) => {
      const item = items.find((i) => i.product.id === productId);
      return item ? item.quantity : 0;
    },
    [items],
  );

  const handleIncrement = useCallback(
    (product: any) => {
      const item = items.find((i) => i.product.id === product.id);
      if (item) {
        updateQuantity(product.id, item.quantity + 1);
      } else {
        handleQuickAdd(product);
      }
    },
    [items, updateQuantity, handleQuickAdd],
  );

  const handleDecrement = useCallback(
    (productId: string) => {
      const item = items.find((i) => i.product.id === productId);
      if (item && item.quantity > 1) {
        updateQuantity(productId, item.quantity - 1);
      } else {
        removeItem(productId);
      }
    },
    [items, updateQuantity, removeItem],
  );

  const toggleModifier = useCallback((groupName: string, optionLabel: string) => {
    setSelectedModifiers((prev) => {
      const current = prev[groupName] || [];
      if (current.includes(optionLabel)) {
        return { ...prev, [groupName]: current.filter((l) => l !== optionLabel) };
      }
      return { ...prev, [groupName]: [...current, optionLabel] };
    });
  }, []);

  const modifierTotal = useMemo(() => {
    if (!activeProduct) return 0;
    let total = 0;
    const mods = activeProduct.modifiers || [];
    for (const group of mods) {
      const selected = selectedModifiers[group.name] || [];
      for (const opt of group.options) {
        if (selected.includes(opt.label)) {
          total += opt.price || 0;
        }
      }
    }
    return total;
  }, [activeProduct, selectedModifiers]);

  const totalPrice = useMemo(() => {
    if (!activeProduct) return 0;
    const base = parseFloat(activeProduct.computedPrice || activeProduct.price || "0");
    return (base + modifierTotal) * quantity;
  }, [activeProduct, modifierTotal, quantity]);

  const handleAddWithModifiers = useCallback(() => {
    if (!activeProduct) return;
    const modDesc = Object.entries(selectedModifiers)
      .filter(([, vals]) => vals.length > 0)
      .map(([group, vals]) => `${group}: ${vals.join(", ")}`)
      .join("; ");
    const productToAdd = {
      ...activeProduct,
      price: String(parseFloat(activeProduct.computedPrice || activeProduct.price) + modifierTotal),
      name: modDesc ? `${activeProduct.name} (${modDesc})` : activeProduct.name,
    };
    addItem(productToAdd, quantity);
    toast({
      title: "Добавлено",
      description: (
        <div className="flex items-center justify-between gap-4">
          <span className="truncate">{activeProduct.name}</span>
          <a
            href={`${basePath}/cart`}
            className="shrink-0 text-primary font-medium hover:underline"
          >
            Корзина
          </a>
        </div>
      ),
    });
    setModifierSheetOpen(false);
    setActiveProduct(null);
  }, [activeProduct, selectedModifiers, modifierTotal, quantity, addItem, toast, basePath]);

  const handleRepeatOrder = useCallback(() => {
    for (const item of lastOrder) {
      const found = activeProducts.find((p: any) => p.id === item.id);
      if (found) {
        const productToAdd = { ...found, price: found.computedPrice || found.price };
        addItem(productToAdd);
      }
    }
    toast({ title: "Заказ добавлен в корзину" });
  }, [lastOrder, activeProducts, addItem, toast]);

  const avgCookingTime = useMemo(() => {
    const times = activeProducts
      .filter((p: any) => p.cookingTime && p.cookingTime > 0)
      .map((p: any) => p.cookingTime as number);
    if (times.length === 0) return null;
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const min = Math.max(avg - 10, 10);
    const max = avg + 10;
    return `${min}-${max} мин`;
  }, [activeProducts]);

  const promoProducts = useMemo(
    () => activeProducts.filter((p: any) => p.tags && p.tags.length > 0).slice(0, 6),
    [activeProducts],
  );

  if (activeProducts.length === 0) {
    return (
      <div className="max-w-2xl mx-auto bg-background min-h-screen">
        <header
          className="sticky top-0 z-[999] flex items-center justify-between gap-2 px-4 bg-background/95 backdrop-blur-xl border-b border-border/50"
          style={{ height: HEADER_HEIGHT }}
        >
          <div className="flex items-center gap-3">
            {tenant?.logoUrl && (
              <img
                src={resolveImageUrl(tenant.logoUrl)}
                alt={tenant.name}
                className="h-9 w-9 rounded-full object-cover ring-2 ring-border/50"
                data-testid="img-tenant-logo"
              />
            )}
            <span className="font-bold text-foreground truncate text-lg" data-testid="text-tenant-name">
              {tenant?.name || slug}
            </span>
          </div>
          <Link href={`${basePath}/cart`}>
            <Button size="icon" variant="ghost" className="relative" data-testid="button-cart">
              <ShoppingCart className="h-5 w-5" />
            </Button>
          </Link>
        </header>
        <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground gap-4 p-8">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <Package className="h-10 w-10" />
          </div>
          <p className="text-lg font-semibold">Меню пока пусто</p>
          <p className="text-sm text-muted-foreground/70">Скоро здесь появятся блюда</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-background min-h-screen relative">
      <header
        className="sticky top-0 z-[999] flex items-center justify-between gap-3 px-4 bg-background/95 backdrop-blur-xl border-b border-border/40"
        style={{ height: HEADER_HEIGHT }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {tenant?.logoUrl && (
            <img
              src={resolveImageUrl(tenant.logoUrl)}
              alt={tenant.name}
              className="h-9 w-9 rounded-full object-cover ring-2 ring-border/50 shrink-0"
              data-testid="img-tenant-logo"
            />
          )}
          <div className="min-w-0">
            <span
              className="font-bold text-foreground truncate block text-base leading-tight"
              data-testid="text-tenant-name"
            >
              {tenant?.name || slug}
            </span>
            {avgCookingTime && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {avgCookingTime}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link href={`${basePath}/cart`}>
            <Button size="icon" variant="ghost" className="relative h-10 w-10" data-testid="button-cart">
              <ShoppingCart className="h-5 w-5" />
              <AnimatePresence>
                {totalItems > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[11px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-sm"
                    data-testid="badge-cart-count"
                  >
                    {totalItems}
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </Link>
        </div>
      </header>

      {activeCategories.length > 0 && (
        <div
          className="sticky z-[998] bg-background/95 backdrop-blur-xl border-b border-border/40"
          style={{ top: HEADER_HEIGHT }}
        >
          <div
            ref={categoryTabsRef}
            className="flex gap-2 px-4 py-2.5 overflow-x-auto"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
          >
            {activeCategories.map((cat: any) => (
              <motion.button
                key={cat.id}
                ref={(el) => { categoryButtonRefs.current[cat.id] = el; }}
                onClick={() => scrollToSection(cat.id)}
                whileTap={{ scale: 0.95 }}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 min-h-[36px] ${
                  activeCategoryId === cat.id
                    ? "bg-foreground text-background shadow-md"
                    : "bg-muted/80 text-muted-foreground"
                }`}
                data-testid={`button-category-${cat.id}`}
              >
                {cat.name}
              </motion.button>
            ))}
            {productsByCategory["__uncategorized"] && (
              <motion.button
                ref={(el) => { categoryButtonRefs.current["__uncategorized"] = el; }}
                onClick={() => scrollToSection("__uncategorized")}
                whileTap={{ scale: 0.95 }}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 min-h-[36px] ${
                  activeCategoryId === "__uncategorized"
                    ? "bg-foreground text-background shadow-md"
                    : "bg-muted/80 text-muted-foreground"
                }`}
                data-testid="button-category-uncategorized"
              >
                Другое
              </motion.button>
            )}
          </div>
        </div>
      )}

      <div className="pb-32">
        {promoProducts.length > 0 && (
          <div className="px-4 pt-5 pb-1">
            <h3 className="text-base font-bold text-foreground mb-3">Рекомендуем</h3>
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
              {promoProducts.map((p: any) => {
                const tagKey = p.tags?.[0];
                const tagCfg = tagKey ? TAG_CONFIG[tagKey] : null;
                return (
                  <motion.div
                    key={p.id}
                    whileTap={{ scale: 0.97 }}
                    className="shrink-0 relative w-40 rounded-2xl overflow-hidden cursor-pointer bg-card shadow-sm border border-border/30"
                    onClick={() => handleQuickAdd(p)}
                    data-testid={`promo-card-${p.id}`}
                  >
                    <div className="w-full h-24 overflow-hidden bg-muted">
                      {p.mainImageUrl ? (
                        <ImageWithSkeleton
                          src={resolveImageUrl(p.mainImageUrl)}
                          alt={p.name}
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ChefHat className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    {tagCfg && (
                      <div className={`absolute top-2 left-2 ${tagCfg.bg} ${tagCfg.text} text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm`}>
                        <tagCfg.icon className="h-2.5 w-2.5" />
                        {tagCfg.label}
                      </div>
                    )}
                    <div className="p-2.5">
                      <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                      <p className="text-sm font-bold text-primary mt-0.5">
                        {formatPrice(p.computedPrice || p.price)}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {lastOrder.length > 0 && items.length === 0 && (
          <div className="px-4 py-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-base font-bold text-foreground">Повторить заказ</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRepeatOrder}
                className="rounded-full text-xs font-semibold gap-1.5"
                data-testid="button-repeat-order"
              >
                Повторить всё
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {lastOrder.slice(0, 6).map((item) => (
                <motion.div
                  key={item.id}
                  whileTap={{ scale: 0.97 }}
                  className="shrink-0 w-32 rounded-2xl overflow-hidden bg-card shadow-sm border border-border/30 cursor-pointer"
                  onClick={handleRepeatOrder}
                  data-testid={`repeat-card-${item.id}`}
                >
                  <div className="w-full h-20 overflow-hidden bg-muted">
                    {item.mainImageUrl ? (
                      <ImageWithSkeleton
                        src={resolveImageUrl(item.mainImageUrl)}
                        alt={item.name}
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ChefHat className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-semibold text-foreground truncate">{item.name}</p>
                    <p className="text-xs font-bold text-primary mt-0.5">{formatPrice(item.price)}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {allSectionIds.map((sectionId) => {
          const cat = activeCategories.find((c: any) => c.id === sectionId);
          const sectionProducts = productsByCategory[sectionId] || [];
          if (sectionProducts.length === 0) return null;

          return (
            <div
              key={sectionId}
              ref={(el) => { sectionRefs.current[sectionId] = el; }}
              data-section-id={sectionId}
              className="px-4 pt-6 pb-2"
            >
              <h2 className="text-xl font-bold text-foreground mb-4" data-testid={`text-category-${sectionId}`}>
                {cat ? cat.name : "Другое"}
              </h2>
              <div className={`grid gap-3 sm:gap-4 ${sectionProducts.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                {sectionProducts.map((product: any) => (
                  <DishCard
                    key={product.id}
                    product={product}
                    onAdd={handleQuickAdd}
                    onIncrement={handleIncrement}
                    onDecrement={handleDecrement}
                    itemQuantity={getItemQuantity(product.id)}
                    isAdding={addedProductId === product.id}
                    slug={slug}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {totalItems > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 350 }}
            className="fixed bottom-0 left-0 right-0 z-[1000] max-w-2xl mx-auto"
            data-testid="badge-cart-summary"
          >
            <div className="mx-3 mb-4">
              <Link href={`${basePath}/cart`}>
                <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 cursor-pointer shadow-xl shadow-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <ShoppingCart className="h-5 w-5 shrink-0" />
                      <span className="absolute -top-2 -right-2 bg-primary-foreground text-primary text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                        {totalItems}
                      </span>
                    </div>
                    <div className="flex -space-x-2">
                      {items.slice(0, 3).map((ci) => (
                        <div key={ci.product.id} className="w-7 h-7 rounded-full overflow-hidden border-2 border-primary bg-muted shrink-0">
                          {ci.product.mainImageUrl ? (
                            <img
                              src={resolveImageUrl(ci.product.mainImageUrl)}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ChefHat className="h-3 w-3 text-primary-foreground/50" />
                            </div>
                          )}
                        </div>
                      ))}
                      {items.length > 3 && (
                        <div className="w-7 h-7 rounded-full bg-primary-foreground/20 border-2 border-primary flex items-center justify-center text-[10px] font-bold">
                          +{items.length - 3}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base">{formatPrice(subtotal)}</span>
                    <ChevronRight className="h-5 w-5 opacity-70" />
                  </div>
                </div>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={modifierSheetOpen} onOpenChange={setModifierSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-0 max-w-2xl mx-auto">
          <SheetHeader className="sr-only">
            <SheetTitle>{activeProduct?.name || "Блюдо"}</SheetTitle>
            <SheetDescription>Настройте блюдо перед добавлением</SheetDescription>
          </SheetHeader>
          {activeProduct && (
            <div className="flex flex-col">
              {activeProduct.mainImageUrl && (
                <div className="w-full aspect-video overflow-hidden bg-muted">
                  <img
                    src={resolveImageUrl(activeProduct.mainImageUrl)}
                    alt={activeProduct.name}
                    className="w-full h-full object-contain p-1"
                  />
                </div>
              )}
              <div className="p-5 flex flex-col gap-5">
                <div>
                  <h3 className="text-xl font-bold text-foreground">{activeProduct.name}</h3>
                  {activeProduct.description && (
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{activeProduct.description}</p>
                  )}
                  <div className="flex items-center flex-wrap gap-2 mt-3">
                    <span className="text-2xl font-bold text-primary">
                      {formatPrice(activeProduct.computedPrice || activeProduct.price)}
                    </span>
                    {activeProduct.hasDiscount && activeProduct.originalPrice && (
                      <span className="text-sm text-muted-foreground line-through">
                        {formatPrice(activeProduct.originalPrice)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center flex-wrap gap-2 mt-2">
                    {activeProduct.weight && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                        {activeProduct.weight}
                      </span>
                    )}
                    {activeProduct.calories && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full flex items-center gap-1">
                        <Flame className="h-3 w-3" />
                        {activeProduct.calories} ккал
                      </span>
                    )}
                    {activeProduct.cookingTime && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {activeProduct.cookingTime} мин
                      </span>
                    )}
                  </div>
                </div>

                {activeProduct.ingredients && (
                  <div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{activeProduct.ingredients}</p>
                  </div>
                )}

                {activeProduct.allergens && activeProduct.allergens.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    {activeProduct.allergens.map((a: string) => (
                      <span key={a} className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                        {a}
                      </span>
                    ))}
                  </div>
                )}

                {activeProduct.modifiers && activeProduct.modifiers.length > 0 && (
                  <div className="flex flex-col gap-4">
                    {activeProduct.modifiers.map((group: any) => (
                      <div key={group.name}>
                        <p className="text-sm font-bold text-foreground mb-2.5">{group.name}</p>
                        <div className="flex flex-col gap-1.5">
                          {group.options.map((opt: any) => {
                            const isSelected = (selectedModifiers[group.name] || []).includes(opt.label);
                            return (
                              <button
                                key={opt.label}
                                onClick={() => toggleModifier(group.name, opt.label)}
                                className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-sm transition-all duration-200 min-h-[48px] ${
                                  isSelected
                                    ? "border-2 border-primary bg-primary/5 shadow-sm"
                                    : "border border-border/50 bg-muted/50 hover:bg-muted"
                                }`}
                                data-testid={`button-modifier-${group.name}-${opt.label}`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div
                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                                      isSelected
                                        ? "bg-primary border-primary"
                                        : "border-muted-foreground/30"
                                    }`}
                                  >
                                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                  </div>
                                  <span className="text-foreground font-medium">{opt.label}</span>
                                </div>
                                {opt.price > 0 && (
                                  <span className="text-muted-foreground shrink-0 text-sm">
                                    +{formatPrice(opt.price)}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-2">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Комментарий к блюду
                  </label>
                  <Textarea
                    value={kitchenComment}
                    onChange={(e) => setKitchenComment(e.target.value)}
                    placeholder="Без лука, острее и т.д."
                    className="resize-none text-sm rounded-xl"
                    rows={2}
                    data-testid="input-kitchen-comment"
                  />
                </div>

                <div className="flex items-center justify-center gap-5">
                  <Button
                    size="icon"
                    variant="outline"
                    className="rounded-full h-10 w-10"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    data-testid="button-quantity-minus"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-xl font-bold min-w-[2rem] text-center text-foreground" data-testid="text-quantity">
                    {quantity}
                  </span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="rounded-full h-10 w-10"
                    onClick={() => setQuantity((q) => q + 1)}
                    data-testid="button-quantity-plus"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <Button
                  className="w-full rounded-xl h-12 text-base font-bold"
                  size="lg"
                  onClick={handleAddWithModifiers}
                  data-testid="button-add-with-modifiers"
                >
                  Добавить за {formatPrice(totalPrice)}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DishCard({
  product,
  onAdd,
  onIncrement,
  onDecrement,
  itemQuantity,
  isAdding,
  slug,
}: {
  product: any;
  onAdd: (p: any) => void;
  onIncrement: (p: any) => void;
  onDecrement: (id: string) => void;
  itemQuantity: number;
  isAdding: boolean;
  slug: string;
}) {
  const isInStock = product.alwaysInStock || product.stockQty > 0;
  const imgUrl = resolveImageUrl(product.mainImageUrl);
  const productTags = (product.tags || []).slice(0, 3);

  return (
    <div
      className={`rounded-2xl overflow-hidden bg-card shadow-sm border border-border/30 flex flex-col relative ${!isInStock ? "opacity-50 pointer-events-none" : ""}`}
      data-testid={`card-dish-${product.id}`}
    >
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-muted">
        {product.videoUrl && product.videoPrimary ? (
          <video
            src={resolveImageUrl(product.videoUrl)}
            poster={resolveImageUrl(product.videoPosterUrl || product.mainImageUrl)}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-contain bg-white dark:bg-black"
            data-testid={`video-product-${product.id}`}
          />
        ) : imgUrl ? (
          <ImageWithSkeleton
            src={imgUrl}
            alt={product.name}
            className="w-full h-full object-contain p-1"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ChefHat className="h-10 w-10 text-muted-foreground/20" />
          </div>
        )}

        {productTags.length > 0 && (
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            {productTags.map((tag: string) => {
              const config = TAG_CONFIG[tag];
              if (!config) return null;
              const Icon = config.icon;
              return (
                <span
                  key={tag}
                  className={`${config.bg} ${config.text} text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm backdrop-blur-sm`}
                  data-testid={`badge-tag-${tag}-${product.id}`}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {config.label}
                </span>
              );
            })}
          </div>
        )}

        {product.hasDiscount && product.discountPercent && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            -{Math.round(product.discountPercent)}%
          </span>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-semibold text-sm text-foreground leading-tight line-clamp-2">{product.name}</h3>

        {product.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">{product.description}</p>
        )}

        <div className="mt-auto pt-2">
          <div className="flex items-end justify-between gap-1">
            <div>
              {product.hasDiscount ? (
                <div className="flex flex-col">
                  <span className="text-[11px] text-muted-foreground line-through">{formatPrice(product.originalPrice)}</span>
                  <span className="text-lg font-bold text-primary leading-none">{formatPrice(product.computedPrice)}</span>
                </div>
              ) : (
                <span className="text-lg font-bold text-primary leading-none">{formatPrice(product.computedPrice || product.price)}</span>
              )}
              {product.weight && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{product.weight}</p>
              )}
            </div>

            {isInStock && (
              <div className="shrink-0">
                <AnimatePresence mode="wait">
                  {itemQuantity > 0 ? (
                    <motion.div
                      key="counter"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="flex items-center gap-0 bg-primary rounded-full shadow-md"
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); onDecrement(product.id); }}
                        className="w-8 h-8 flex items-center justify-center text-primary-foreground"
                        data-testid={`button-decrement-${product.id}`}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-sm font-bold text-primary-foreground min-w-[20px] text-center">
                        {itemQuantity}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onIncrement(product); }}
                        className="w-8 h-8 flex items-center justify-center text-primary-foreground"
                        data-testid={`button-increment-${product.id}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="add"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => { e.stopPropagation(); onAdd(product); }}
                      className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md shadow-primary/30"
                      data-testid={`button-add-dish-${product.id}`}
                    >
                      <motion.div
                        animate={isAdding ? { rotate: 90 } : { rotate: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Plus className="h-5 w-5" />
                      </motion.div>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
