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

const TAG_CONFIG: Record<string, { label: string; color: string }> = {
  hit: { label: "Хит", color: "bg-amber-500" },
  new: { label: "Новинка", color: "bg-blue-500" },
  best_price: { label: "Лучшая цена", color: "bg-green-500" },
  sale: { label: "Распродажа", color: "bg-red-500" },
};


function formatPrice(value: number | string) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("ru-KZ").format(num) + " \u20B8";
}

const HEADER_HEIGHT = 56;
const CATEGORIES_HEIGHT = 48;

interface LastOrderItem {
  id: string;
  name: string;
  price: string;
  mainImageUrl?: string | null;
}

export default function FoodCatalog({
  slug,
  basePath,
  tenant,
  products,
  categories,
}: FoodCatalogProps) {
  const { addItem, totalItems, subtotal, setTenantSlug, items } = useCart();
  const { toast } = useToast();

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [modifierSheetOpen, setModifierSheetOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<any | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [kitchenComment, setKitchenComment] = useState("");
  const [isScrollingByClick, setIsScrollingByClick] = useState(false);
  const isScrollingByClickRef = useRef(false);

  const categoryTabsRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const categoryButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const lastOrderKey = `last_order_${slug}`;

  useEffect(() => {
    setTenantSlug(slug);
  }, [slug, setTenantSlug]);

  useEffect(() => {
    if (items.length > 0) {
      const orderItems: LastOrderItem[] = items.slice(0, 4).map((ci) => ({
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
      toast({
        title: "Добавлено",
        description: (
          <div className="flex items-center justify-between gap-4">
            <span className="truncate">{product.name}</span>
            <a
              href={`${basePath}/cart`}
              className="shrink-0 text-primary font-medium hover:underline"
            >
              Корзина
            </a>
          </div>
        ),
      });
    },
    [addItem, toast, slug, openModifierSheet],
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
  }, [activeProduct, selectedModifiers, modifierTotal, quantity, addItem, toast, slug]);

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
    return `~${min}-${max} мин`;
  }, [activeProducts]);

  const promoProducts = useMemo(
    () => activeProducts.filter((p: any) => p.tags && p.tags.length > 0).slice(0, 6),
    [activeProducts],
  );

  if (activeProducts.length === 0) {
    return (
      <div className="max-w-2xl mx-auto bg-background min-h-screen">
        <header
          className="sticky top-0 z-[999] flex items-center justify-between gap-2 px-4 bg-background/90 backdrop-blur-md border-b"
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
            <span className="font-semibold text-foreground truncate" data-testid="text-tenant-name">
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
          <Package className="h-16 w-16" />
          <p className="text-lg font-medium">Меню пока пусто</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-background min-h-screen relative">
      <header
        className="sticky top-0 z-[999] flex items-center justify-between gap-2 px-4 bg-background/90 backdrop-blur-md border-b"
        style={{ height: HEADER_HEIGHT }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {tenant?.logoUrl && (
            <img
              src={resolveImageUrl(tenant.logoUrl)}
              alt={tenant.name}
              className="h-8 w-8 rounded-full object-cover shrink-0"
              data-testid="img-tenant-logo"
            />
          )}
          <span
            className="font-semibold text-foreground truncate"
            data-testid="text-tenant-name"
          >
            {tenant?.name || slug}
          </span>
          {avgCookingTime && (
            <Badge variant="secondary" className="shrink-0 no-default-hover-elevate no-default-active-elevate">
              <Clock className="h-3 w-3 mr-1" />
              {avgCookingTime}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link href={`${basePath}/cart`}>
            <Button size="icon" variant="ghost" className="relative" data-testid="button-cart">
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

      {activeCategories.length > 0 && (
        <div
          className="sticky z-[998] border-b bg-background/90 backdrop-blur-md"
          style={{ top: HEADER_HEIGHT }}
        >
          <div
            ref={categoryTabsRef}
            className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {activeCategories.map((cat: any) => (
              <button
                key={cat.id}
                ref={(el) => { categoryButtonRefs.current[cat.id] = el; }}
                onClick={() => scrollToSection(cat.id)}
                className={`shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-[36px] ${
                  activeCategoryId === cat.id
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground"
                }`}
                data-testid={`button-category-${cat.id}`}
              >
                {cat.name}
              </button>
            ))}
            {productsByCategory["__uncategorized"] && (
              <button
                ref={(el) => { categoryButtonRefs.current["__uncategorized"] = el; }}
                onClick={() => scrollToSection("__uncategorized")}
                className={`shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-[36px] ${
                  activeCategoryId === "__uncategorized"
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground"
                }`}
                data-testid="button-category-uncategorized"
              >
                Другое
              </button>
            )}
          </div>
        </div>
      )}

      <div className="pb-28">
        {promoProducts.length > 0 && (
          <div className="px-4 pt-4 pb-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
              {promoProducts.map((p: any) => {
                const tagKey = p.tags?.[0];
                const tagCfg = tagKey ? TAG_CONFIG[tagKey] : null;
                return (
                  <div
                    key={p.id}
                    className="shrink-0 relative w-32 h-20 rounded-md overflow-hidden cursor-pointer"
                    onClick={() => handleQuickAdd(p)}
                    data-testid={`promo-card-${p.id}`}
                  >
                    {p.mainImageUrl ? (
                      <img
                        src={resolveImageUrl(p.mainImageUrl)}
                        alt={p.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <ChefHat className="h-6 w-6 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    {tagCfg && (
                      <Badge
                        className={`absolute top-1 left-1 text-white text-[10px] px-1.5 py-0 ${tagCfg.color} no-default-hover-elevate no-default-active-elevate`}
                      >
                        {tagCfg.label}
                      </Badge>
                    )}
                    <span className="absolute bottom-1 left-1 right-1 text-white text-xs font-medium truncate">
                      {p.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {lastOrder.length > 0 && items.length === 0 && (
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold text-foreground">Повторить заказ</h3>
              <Button size="sm" variant="outline" onClick={handleRepeatOrder} data-testid="button-repeat-order">
                Повторить
              </Button>
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
              {lastOrder.slice(0, 4).map((item) => (
                <div key={item.id} className="shrink-0 flex items-center gap-2 rounded-md bg-muted p-2 min-w-[140px]">
                  {item.mainImageUrl ? (
                    <img
                      src={resolveImageUrl(item.mainImageUrl)}
                      alt={item.name}
                      className="w-10 h-10 rounded-md object-cover shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-muted-foreground/10 flex items-center justify-center shrink-0">
                      <ChefHat className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{formatPrice(item.price)}</p>
                  </div>
                </div>
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
              <h2 className="text-lg font-bold text-foreground mb-3" data-testid={`text-category-${sectionId}`}>
                {cat ? cat.name : "Другое"}
              </h2>
              <div className="flex flex-col gap-3">
                {sectionProducts.map((product: any) => (
                  <DishCard
                    key={product.id}
                    product={product}
                    onAdd={handleQuickAdd}
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
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-4 left-0 right-0 z-[1000] px-4 max-w-2xl mx-auto"
            data-testid="badge-cart-summary"
          >
            <Link href={`${basePath}/cart`}>
              <div className="bg-primary text-primary-foreground rounded-md px-4 py-3 flex items-center justify-between gap-4 cursor-pointer shadow-lg min-h-[48px]">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-medium">
                    {totalItems} {totalItems === 1 ? "товар" : totalItems < 5 ? "товара" : "товаров"}
                  </span>
                  <span className="text-sm font-bold">{formatPrice(subtotal)}</span>
                </div>
                <span className="font-semibold text-sm">Корзина</span>
              </div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={modifierSheetOpen} onOpenChange={setModifierSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-xl p-0 max-w-2xl mx-auto">
          <SheetHeader className="sr-only">
            <SheetTitle>{activeProduct?.name || "Блюдо"}</SheetTitle>
            <SheetDescription>Настройте блюдо перед добавлением</SheetDescription>
          </SheetHeader>
          {activeProduct && (
            <div className="flex flex-col">
              {activeProduct.mainImageUrl && (
                <div className="w-full h-48 overflow-hidden">
                  <img
                    src={resolveImageUrl(activeProduct.mainImageUrl)}
                    alt={activeProduct.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-4 flex flex-col gap-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{activeProduct.name}</h3>
                  {activeProduct.description && (
                    <p className="text-sm text-muted-foreground mt-1">{activeProduct.description}</p>
                  )}
                  <div className="flex items-center flex-wrap gap-2 mt-2">
                    {activeProduct.weight && (
                      <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                        {activeProduct.weight}
                      </Badge>
                    )}
                    {activeProduct.calories && (
                      <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                        <Flame className="h-3 w-3 mr-1" />
                        {activeProduct.calories} ккал
                      </Badge>
                    )}
                    {activeProduct.cookingTime && (
                      <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                        <Clock className="h-3 w-3 mr-1" />
                        {activeProduct.cookingTime} мин
                      </Badge>
                    )}
                  </div>
                </div>

                {activeProduct.ingredients && (
                  <div>
                    <p className="text-xs text-muted-foreground">{activeProduct.ingredients}</p>
                  </div>
                )}

                {activeProduct.allergens && activeProduct.allergens.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    {activeProduct.allergens.map((a: string) => (
                      <Badge key={a} variant="outline" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
                        {a}
                      </Badge>
                    ))}
                  </div>
                )}

                {activeProduct.modifiers && activeProduct.modifiers.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {activeProduct.modifiers.map((group: any) => (
                      <div key={group.name}>
                        <p className="text-sm font-semibold text-foreground mb-2">{group.name}</p>
                        <div className="flex flex-col gap-1">
                          {group.options.map((opt: any) => {
                            const isSelected = (selectedModifiers[group.name] || []).includes(opt.label);
                            return (
                              <button
                                key={opt.label}
                                onClick={() => toggleModifier(group.name, opt.label)}
                                className={`flex items-center justify-between px-3 py-2.5 rounded-md border text-sm transition-colors min-h-[44px] ${
                                  isSelected
                                    ? "border-primary bg-primary/5"
                                    : "border-transparent bg-muted"
                                }`}
                                data-testid={`button-modifier-${group.name}-${opt.label}`}
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                                      isSelected
                                        ? "bg-primary border-primary"
                                        : "border-muted-foreground/30"
                                    }`}
                                  >
                                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                  </div>
                                  <span className="text-foreground">{opt.label}</span>
                                </div>
                                {opt.price > 0 && (
                                  <span className="text-muted-foreground shrink-0">
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
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5 mb-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Комментарий к блюду
                  </label>
                  <Textarea
                    value={kitchenComment}
                    onChange={(e) => setKitchenComment(e.target.value)}
                    placeholder="Без лука, острее и т.д."
                    className="resize-none text-sm"
                    rows={2}
                    data-testid="input-kitchen-comment"
                  />
                </div>

                <div className="flex items-center justify-center gap-4">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    data-testid="button-quantity-minus"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-lg font-bold min-w-[2rem] text-center text-foreground" data-testid="text-quantity">
                    {quantity}
                  </span>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setQuantity((q) => q + 1)}
                    data-testid="button-quantity-plus"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <Button
                  className="w-full"
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
  slug,
}: {
  product: any;
  onAdd: (p: any) => void;
  slug: string;
}) {
  const isInStock = product.alwaysInStock || product.stockQty > 0;
  const imgUrl = resolveImageUrl(product.mainImageUrl);

  return (
    <div
      className={`flex gap-3 ${!isInStock ? "opacity-50" : ""}`}
      data-testid={`card-dish-${product.id}`}
    >
      <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
        <div>
          <div className="flex items-start gap-1.5 flex-wrap">
            <h3 className="font-semibold text-base text-foreground leading-tight">{product.name}</h3>
            {product.tags && product.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {product.tags.slice(0, 2).map((tag: string) => {
                  const config = TAG_CONFIG[tag];
                  if (!config) return null;
                  return (
                    <Badge
                      key={tag}
                      className={`${config.color} text-white text-[10px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate`}
                      data-testid={`badge-tag-${tag}-${product.id}`}
                    >
                      {config.label}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
          {product.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{product.description}</p>
          )}
        </div>
        <div className="flex items-center flex-wrap gap-2 mt-2">
          {product.hasDiscount ? (
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-foreground">{formatPrice(product.computedPrice)}</span>
              <span className="text-xs text-muted-foreground line-through">{formatPrice(product.originalPrice)}</span>
            </div>
          ) : (
            <span className="font-bold text-foreground">{formatPrice(product.computedPrice || product.price)}</span>
          )}
          {product.weight && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate">
              {product.weight}
            </Badge>
          )}
          {product.cookingTime && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate">
              <Clock className="h-2.5 w-2.5 mr-0.5" />
              {product.cookingTime} мин
            </Badge>
          )}
          {product.allergens && product.allergens.length > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate">
              <AlertTriangle className="h-2.5 w-2.5 mr-0.5 text-amber-500" />
              {product.allergens.length}
            </Badge>
          )}
        </div>
      </div>

      <div className="relative shrink-0 w-24 h-24 sm:w-28 sm:h-28">
        <div className="w-full h-full rounded-md overflow-hidden bg-muted">
          {product.videoUrl && product.videoPrimary ? (
            <video
              src={resolveImageUrl(product.videoUrl)}
              poster={resolveImageUrl(product.videoPosterUrl || product.mainImageUrl)}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-contain bg-black"
              data-testid={`video-product-${product.id}`}
            />
          ) : imgUrl ? (
            <img
              src={imgUrl}
              alt={product.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ChefHat className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}
        </div>
        {product.hasDiscount && product.discountPercent && (
          <Badge className="absolute top-1 left-1 bg-red-500 text-white text-[10px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate">
            <Percent className="h-2.5 w-2.5 mr-0.5" />
            -{Math.round(product.discountPercent)}%
          </Badge>
        )}
        {isInStock && (
          <button
            onClick={() => onAdd(product)}
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md"
            data-testid={`button-add-dish-${product.id}`}
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
