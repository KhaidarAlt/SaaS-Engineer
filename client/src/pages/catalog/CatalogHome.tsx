import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import {
  Search,
  ShoppingCart,
  Filter,
  ChevronRight,
  Tag,
  Sparkles,
  Package,
  Percent,
} from "lucide-react";
import { useState } from "react";
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
      whileHover={{ y: -4 }}
    >
      <Card className="group overflow-hidden h-full">
        <Link href={`/c/${tenantSlug}/product/${product.id}`}>
          <div className="aspect-square relative overflow-hidden bg-muted cursor-pointer">
            {product.mainImageUrl ? (
              <img
                src={product.mainImageUrl}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
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
            <h3 className="font-medium line-clamp-2 mb-2 cursor-pointer hover:text-primary transition-colors">
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
  const { items, totalItems } = useCart();

  const { data, isLoading, error } = useQuery<CatalogData>({
    queryKey: ["/api/catalog", slug],
    enabled: !!slug,
  });

  const getSubcategoryIds = (parentId: string): string[] => {
    return data?.categories?.filter(c => c.parentId === parentId).map(c => c.id) || [];
  };

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
    return product.isActive && matchesSearch && matchesCategory && matchesStock;
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
          <div className="flex items-center justify-between h-16">
            <Link href={`/c/${slug}`}>
              <h1 className="text-xl font-bold tracking-tight cursor-pointer">
                {data?.tenant?.name || "Каталог"}
              </h1>
            </Link>
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
              return (
                <div key={parentCat.id} className="flex flex-wrap gap-1 items-center">
                  <Badge
                    variant={categoryFilter === parentCat.id ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setCategoryFilter(parentCat.id)}
                  >
                    {parentCat.name}
                  </Badge>
                  {subcats.length > 0 && subcats.map((subCat) => (
                    <Badge
                      key={subCat.id}
                      variant={categoryFilter === subCat.id ? "default" : "secondary"}
                      className="cursor-pointer text-xs"
                      onClick={() => setCategoryFilter(subCat.id)}
                    >
                      {subCat.name}
                    </Badge>
                  ))}
                </div>
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
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 text-center">
          <p className="text-sm text-muted-foreground">
            {data?.tenant?.name} © {new Date().getFullYear()}
          </p>
          {data?.tenant?.contactPhone && (
            <p className="text-sm text-muted-foreground mt-1">
              Тел: {data.tenant.contactPhone}
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
