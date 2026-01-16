import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import {
  Search,
  ShoppingCart,
  Filter,
  ChevronRight,
  ChevronDown,
  Tag,
  Sparkles,
  Package,
  Percent,
  Phone,
  MapPin,
  Clock,
} from "lucide-react";
import { useState, useEffect } from "react";
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
import { ThemeToggle } from "@/components/ThemeToggle";
import { CardSkeleton } from "@/components/LoadingSpinner";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import type { Tenant, Product, Category, Promotion } from "@shared/schema";

interface ProductWithPrice extends Product {
  computedPrice: string;
  originalPrice: string;
  discountPercent: number | null;
  discountType: string | null;
  hasDiscount: boolean;
  promotionName?: string;
  discountName?: string;
}

interface CatalogData {
  tenant: Tenant;
  products: ProductWithPrice[];
  categories: Category[];
  promotions: Promotion[];
}

function ProductCard({ product, tenantSlug }: { product: ProductWithPrice; tenantSlug: string }) {
  const { addItem } = useCart();
  const { toast } = useToast();
  
  const isInStock = product.alwaysInStock || product.stockQty > 0;

  const formatPrice = (value: number | string) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("ru-KZ").format(num) + " ₸";
  };

  const handleAddToCart = () => {
    addItem(product);
    toast({
      title: "Добавлено в корзину",
      description: product.name,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden h-full hover-elevate">
        <Link href={`/c/${tenantSlug}/product/${product.id}`}>
          <div className="aspect-square relative overflow-hidden bg-muted cursor-pointer">
            {product.mainImageUrl ? (
              <img
                src={product.mainImageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
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
            <div className="absolute top-2 right-2 flex flex-col gap-1">
              {!isInStock && (
                <Badge variant="destructive">Нет в наличии</Badge>
              )}
            </div>
          </div>
        </Link>
        <CardContent className="p-4">
          <Link href={`/c/${tenantSlug}/product/${product.id}`}>
            <h3 className="font-medium line-clamp-2 mb-2 cursor-pointer text-foreground">
              {product.name}
            </h3>
          </Link>
          <div className="flex items-center justify-between mt-auto gap-2">
            <div className="flex flex-col">
              {product.hasDiscount ? (
                <>
                  <p className="text-lg font-bold text-red-500">
                    {formatPrice(product.computedPrice)}
                  </p>
                  <p className="text-sm text-muted-foreground line-through">
                    {formatPrice(product.originalPrice)}
                  </p>
                </>
              ) : (
                <p className="text-lg font-bold">{formatPrice(product.computedPrice)}</p>
              )}
            </div>
            <Button
              size="sm"
              disabled={!isInStock}
              onClick={handleAddToCart}
              data-testid={`button-add-cart-${product.id}`}
            >
              <ShoppingCart className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function CatalogHome() {
  const [, params] = useRoute("/c/:slug");
  const slug = params?.slug || "";
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [sizeFilter, setSizeFilter] = useState<string>("all");
  const [colorFilter, setColorFilter] = useState<string>("all");
  const { items, totalItems } = useCart();

  const { data, isLoading, error } = useQuery<CatalogData>({
    queryKey: ["/api/catalog", slug],
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
    const isInStock = product.alwaysInStock || product.stockQty > 0;
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

    return product.isActive && matchesSearch && matchesCategory && matchesStock && matchesSize && matchesColor;
  });

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
            <Link href={`/c/${slug}`}>
              <div className="flex items-center gap-3 cursor-pointer">
                {data?.tenant?.logoUrl && (
                  <img 
                    src={data.tenant.logoUrl} 
                    alt={data.tenant.name} 
                    className="h-10 w-10 object-contain rounded-lg"
                  />
                )}
                <h1 className="text-xl font-bold tracking-tight">
                  {data?.tenant?.name || "Каталог"}
                </h1>
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
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <MapPin className="h-4 w-4" />
                    <span className="max-w-[200px] truncate">{data.tenant.address}</span>
                  </a>
                ) : (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    <span className="max-w-[200px] truncate">{data.tenant.address}</span>
                  </span>
                )
              )}
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link href={`/c/${slug}/cart`}>
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
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    <MapPin className="h-3 w-3" />
                    <span className="max-w-[150px] truncate">{data.tenant.address}</span>
                  </a>
                ) : (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span className="max-w-[150px] truncate">{data.tenant.address}</span>
                  </span>
                )
              )}
            </div>
          )}
        </div>
      </header>

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

        {data?.categories && data.categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <Badge
              variant={categoryFilter === "all" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setCategoryFilter("all")}
            >
              Все
            </Badge>
            {data.categories.filter(c => !c.parentId).map((parentCat) => {
              const subcats = data.categories?.filter(sub => sub.parentId === parentCat.id) || [];
              const isParentOrChildSelected = categoryFilter === parentCat.id || 
                subcats.some(sub => sub.id === categoryFilter);
              
              if (subcats.length === 0) {
                return (
                  <Badge
                    key={parentCat.id}
                    variant={categoryFilter === parentCat.id ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setCategoryFilter(parentCat.id)}
                  >
                    {parentCat.name}
                  </Badge>
                );
              }
              
              return (
                <DropdownMenu key={parentCat.id}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={isParentOrChildSelected ? "default" : "outline"}
                      size="sm"
                      className="gap-1"
                      data-testid={`dropdown-category-${parentCat.id}`}
                    >
                      {parentCat.name}
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem 
                      onClick={() => setCategoryFilter(parentCat.id)}
                      data-testid={`menu-all-${parentCat.id}`}
                    >
                      Все {parentCat.name}
                    </DropdownMenuItem>
                    {subcats.map((subCat) => (
                      <DropdownMenuItem 
                        key={subCat.id} 
                        onClick={() => setCategoryFilter(subCat.id)}
                        className={categoryFilter === subCat.id ? "bg-accent" : ""}
                        data-testid={`menu-subcat-${subCat.id}`}
                      >
                        {subCat.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : filteredProducts && filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} tenantSlug={slug} />
            ))}
          </div>
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
                  src={data.tenant.logoUrl} 
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
    </div>
  );
}
