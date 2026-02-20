import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { resolveImageUrl } from "@/lib/imageUrl";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Package,
  Tag,
  Check,
  Star,
  ShoppingCart,
  X,
  Bot,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { DashboardLayout } from "@/components/DashboardLayout";
import { TableRowSkeleton } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Product, Category, CategoryAiPriority } from "@shared/schema";

const AVAILABLE_TAGS = [
  { value: "hit", label: "Хит продаж" },
  { value: "new", label: "Новинка" },
  { value: "best_price", label: "Лучшая цена" },
  { value: "sale", label: "Распродажа" },
  { value: "delivery_today", label: "Доставка сегодня" },
  { value: "in_stock", label: "В наличии" },
  { value: "low_stock", label: "Мало на складе" },
];

function InlinePrice({ product }: { product: Product }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(product.price);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    setValue(product.price);
  }, [product.price]);

  const mutation = useMutation({
    mutationFn: async (newPrice: string) => {
      await apiRequest("PATCH", `/api/products/${product.id}`, { price: newPrice });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Цена обновлена" });
      setEditing(false);
    },
    onError: () => {
      toast({ title: "Ошибка обновления цены", variant: "destructive" });
      setValue(product.price);
      setEditing(false);
    },
  });

  const handleSave = () => {
    const numVal = parseFloat(value);
    if (isNaN(numVal) || numVal < 0) {
      toast({ title: "Некорректная цена", variant: "destructive" });
      setValue(product.price);
      setEditing(false);
      return;
    }
    if (value !== product.price) {
      mutation.mutate(String(numVal));
    } else {
      setEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setValue(product.price);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-28 text-right"
        data-testid={`input-price-${product.id}`}
        disabled={mutation.isPending}
      />
    );
  }

  const formatted = new Intl.NumberFormat("ru-KZ").format(parseFloat(product.price)) + " ₸";

  return (
    <span
      onClick={() => setEditing(true)}
      className="cursor-pointer font-medium transition-colors border-b border-dashed border-muted-foreground/30"
      data-testid={`text-price-${product.id}`}
    >
      {formatted}
    </span>
  );
}

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [confirmReplace, setConfirmReplace] = useState<{ product: Product; existingProductName: string } | null>(null);
  const [crossSellDialog, setCrossSellDialog] = useState<Product | null>(null);
  const [crossSellSearch, setCrossSellSearch] = useState("");
  const [selectedCrossSell, setSelectedCrossSell] = useState<string[]>([]);
  const [upsellDialog, setUpsellDialog] = useState<Product | null>(null);
  const [upsellSearch, setUpsellSearch] = useState("");
  const [selectedUpsell, setSelectedUpsell] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: priorities } = useQuery<CategoryAiPriority[]>({
    queryKey: ["/api/category-priority"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Товар удалён" });
    },
    onError: () => {
      toast({ title: "Ошибка удаления", variant: "destructive" });
    },
  });

  const updateFieldMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      await apiRequest("PATCH", `/api/products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Товар обновлён" });
    },
    onError: () => {
      toast({ title: "Ошибка обновления", variant: "destructive" });
    },
  });

  const filteredProducts = products?.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || product.categoryId === categoryFilter;
    const matchesStock =
      stockFilter === "all" ||
      (stockFilter === "in_stock" && (product.alwaysInStock || product.stockQty > 0)) ||
      (stockFilter === "out_of_stock" && !product.alwaysInStock && product.stockQty <= 0);
    return matchesSearch && matchesCategory && matchesStock;
  });

  const getStockSelectValue = (product: Product): string => {
    if (product.alwaysInStock) return "always";
    if (product.stockQty > 0) return "in_stock";
    return "out_of_stock";
  };

  const handleStockChange = (product: Product, newValue: string) => {
    const data: Record<string, any> = {};
    if (newValue === "always") {
      data.alwaysInStock = true;
    } else if (newValue === "in_stock") {
      data.alwaysInStock = false;
      if (product.stockQty <= 0) {
        data.stockQty = 1;
      }
    } else {
      data.alwaysInStock = false;
      data.stockQty = 0;
    }
    updateFieldMutation.mutate({ id: product.id, data });
  };

  const handleCategoryChange = (product: Product, newCategoryId: string) => {
    const catId = newCategoryId === "none" ? null : newCategoryId;
    updateFieldMutation.mutate({ id: product.id, data: { categoryId: catId } });
  };

  const handleToggleActive = (product: Product, checked: boolean) => {
    updateFieldMutation.mutate({ id: product.id, data: { isActive: checked } });
  };

  const handleToggleTag = (product: Product, tag: string) => {
    const currentTags = product.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    updateFieldMutation.mutate({ id: product.id, data: { tags: newTags } });
  };

  const setPriorityMutation = useMutation({
    mutationFn: async ({ categoryId, productId }: { categoryId: string; productId: string }) => {
      await apiRequest("PUT", "/api/category-priority", { categoryId, productId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/category-priority"] });
      toast({ title: "Приоритетный товар установлен" });
    },
    onError: () => {
      toast({ title: "Ошибка установки приоритета", variant: "destructive" });
    },
  });

  const removePriorityMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      await apiRequest("DELETE", `/api/category-priority/${categoryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/category-priority"] });
      toast({ title: "Приоритет снят" });
    },
  });

  const saveCrossSellMutation = useMutation({
    mutationFn: async ({ productId, relatedProductIds }: { productId: string; relatedProductIds: string[] }) => {
      await apiRequest("PUT", `/api/products/${productId}/cross-sell`, { relatedProductIds });
    },
    onSuccess: () => {
      toast({ title: "Сопутствующие товары сохранены" });
      setCrossSellDialog(null);
    },
    onError: () => {
      toast({ title: "Ошибка сохранения", variant: "destructive" });
    },
  });

  const handleSetPriority = (product: Product) => {
    if (!product.categoryId) {
      toast({ title: "Сначала назначьте категорию товару", variant: "destructive" });
      return;
    }
    const existingPriority = priorities?.find(p => p.categoryId === product.categoryId);
    if (existingPriority && existingPriority.productId !== product.id) {
      const existingProduct = products?.find(p => p.id === existingPriority.productId);
      setConfirmReplace({ product, existingProductName: existingProduct?.name || "Другой товар" });
    } else if (existingPriority && existingPriority.productId === product.id) {
      removePriorityMutation.mutate(product.categoryId);
    } else {
      setPriorityMutation.mutate({ categoryId: product.categoryId, productId: product.id });
      openCrossSellDialog(product);
    }
  };

  const confirmSetPriority = () => {
    if (!confirmReplace) return;
    const { product } = confirmReplace;
    setPriorityMutation.mutate({ categoryId: product.categoryId!, productId: product.id });
    setConfirmReplace(null);
    openCrossSellDialog(product);
  };

  const openCrossSellDialog = async (product: Product) => {
    try {
      const res = await fetch(`/api/products/${product.id}/cross-sell`, { credentials: "include" });
      const items = await res.json();
      setSelectedCrossSell(items.map((i: any) => i.relatedProductId));
    } catch {
      setSelectedCrossSell([]);
    }
    setCrossSellSearch("");
    setCrossSellDialog(product);
  };

  const handleToggleCrossSell = (relatedId: string) => {
    setSelectedCrossSell(prev => {
      if (prev.includes(relatedId)) return prev.filter(id => id !== relatedId);
      if (prev.length >= 3) return prev;
      return [...prev, relatedId];
    });
  };

  const saveUpsellMutation = useMutation({
    mutationFn: async ({ productId, upsellProductId }: { productId: string; upsellProductId: string }) => {
      await apiRequest("PUT", `/api/products/${productId}/upsell`, { upsellProductId });
    },
    onSuccess: () => {
      toast({ title: "Апселл-товар сохранён" });
      setUpsellDialog(null);
    },
    onError: () => {
      toast({ title: "Ошибка сохранения", variant: "destructive" });
    },
  });

  const removeUpsellMutation = useMutation({
    mutationFn: async (productId: string) => {
      await apiRequest("DELETE", `/api/products/${productId}/upsell`);
    },
    onSuccess: () => {
      toast({ title: "Апселл-товар убран" });
      setUpsellDialog(null);
    },
  });

  const openUpsellDialog = async (product: Product) => {
    try {
      const res = await fetch(`/api/products/${product.id}/upsell`, { credentials: "include" });
      const item = await res.json();
      setSelectedUpsell(item?.upsellProductId || null);
    } catch {
      setSelectedUpsell(null);
    }
    setUpsellSearch("");
    setUpsellDialog(product);
  };

  const isPriorityProduct = (product: Product) => {
    return priorities?.some(p => p.productId === product.id && p.categoryId === product.categoryId) || false;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Товары</h1>
            <p className="text-muted-foreground">
              Управляйте каталогом товаров
            </p>
          </div>
          <Link href="/dashboard/products/new">
            <Button data-testid="button-add-product">
              <Plus className="h-4 w-4 mr-2" />
              Добавить товар
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по названию или артикулу..."
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
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-full sm:w-48" data-testid="select-stock">
                  <SelectValue placeholder="Наличие" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все товары</SelectItem>
                  <SelectItem value="in_stock">В наличии</SelectItem>
                  <SelectItem value="out_of_stock">Нет в наличии</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16"></TableHead>
                  <TableHead>Товар</TableHead>
                  <TableHead>Артикул</TableHead>
                  <TableHead>Категория</TableHead>
                  <TableHead>Цена</TableHead>
                  <TableHead>Наличие</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => <TableRowSkeleton key={i} cols={8} />)
                ) : filteredProducts && filteredProducts.length > 0 ? (
                  filteredProducts.map((product, index) => (
                    <motion.tr
                      key={product.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="group border-b"
                    >
                      <TableCell>
                        <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden">
                          {product.mainImageUrl ? (
                            <img
                              src={resolveImageUrl(product.mainImageUrl)}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span>{product.name}</span>
                            {isPriorityProduct(product) && (
                              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
                            )}
                          </div>
                          {product.tags && product.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {product.tags.map((tag) => {
                                const tagInfo = AVAILABLE_TAGS.find((t) => t.value === tag);
                                return (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tagInfo?.label || tag}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{product.sku}</TableCell>
                      <TableCell>
                        <Select
                          value={product.categoryId || "none"}
                          onValueChange={(val) => handleCategoryChange(product, val)}
                        >
                          <SelectTrigger
                            className="w-40 border-dashed"
                            data-testid={`select-inline-category-${product.id}`}
                          >
                            <SelectValue placeholder="Без категории" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Без категории</SelectItem>
                            {categories?.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <InlinePrice product={product} />
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const stockVal = getStockSelectValue(product);
                          const isAvailable = stockVal === "in_stock" || stockVal === "always";
                          const triggerClass = isAvailable
                            ? "w-44 border-green-500 bg-green-50 text-green-700 dark:border-green-600 dark:bg-green-950 dark:text-green-400"
                            : "w-44 border-red-500 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-950 dark:text-red-400";
                          return (
                            <Select
                              value={stockVal}
                              onValueChange={(val) => handleStockChange(product, val)}
                            >
                              <SelectTrigger
                                className={triggerClass}
                                data-testid={`select-inline-stock-${product.id}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="out_of_stock">Нет в наличии</SelectItem>
                                <SelectItem value="in_stock">В наличии</SelectItem>
                                <SelectItem value="always">Всегда в наличии</SelectItem>
                              </SelectContent>
                            </Select>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={product.isActive}
                            onCheckedChange={(checked) => handleToggleActive(product, checked)}
                            data-testid={`switch-active-${product.id}`}
                          />
                          <span className="text-sm text-muted-foreground">
                            {product.isActive ? "Активен" : "Скрыт"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`menu-product-${product.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <Link href={`/dashboard/products/${product.id}`}>
                              <DropdownMenuItem>
                                <Pencil className="h-4 w-4 mr-2" />
                                Редактировать
                              </DropdownMenuItem>
                            </Link>
                            <DropdownMenuItem
                              onClick={() =>
                                updateFieldMutation.mutate({
                                  id: product.id,
                                  data: { isActive: !product.isActive },
                                })
                              }
                            >
                              {product.isActive ? (
                                <>
                                  <EyeOff className="h-4 w-4 mr-2" />
                                  Скрыть
                                </>
                              ) : (
                                <>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Показать
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <Tag className="h-4 w-4 mr-2" />
                                Теги
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {AVAILABLE_TAGS.map((tag) => {
                                  const isSelected = (product.tags || []).includes(tag.value);
                                  return (
                                    <DropdownMenuItem
                                      key={tag.value}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        handleToggleTag(product, tag.value);
                                      }}
                                      data-testid={`tag-${tag.value}-${product.id}`}
                                    >
                                      <div className="flex items-center gap-2 w-full">
                                        <div className="w-4 h-4 rounded-sm border flex items-center justify-center">
                                          {isSelected && <Check className="h-3 w-3" />}
                                        </div>
                                        <span>{tag.label}</span>
                                      </div>
                                    </DropdownMenuItem>
                                  );
                                })}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger data-testid={`ai-sales-menu-${product.id}`}>
                                <Bot className="h-4 w-4 mr-2" />
                                AI продажи
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleSetPriority(product);
                                  }}
                                  data-testid={`set-priority-${product.id}`}
                                >
                                  <div className="flex items-center gap-2 w-full">
                                    <Star className={`h-4 w-4 ${isPriorityProduct(product) ? "text-amber-500 fill-amber-500" : ""}`} />
                                    <span>{isPriorityProduct(product) ? "Снять приоритет" : "Приоритетный товар"}</span>
                                  </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault();
                                    openCrossSellDialog(product);
                                  }}
                                  data-testid={`set-cross-sell-${product.id}`}
                                >
                                  <ShoppingCart className="h-4 w-4 mr-2" />
                                  Сопутствующие товары
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault();
                                    openUpsellDialog(product);
                                  }}
                                  data-testid={`set-upsell-${product.id}`}
                                >
                                  <TrendingUp className="h-4 w-4 mr-2" />
                                  Апселл-товар
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate(product.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Удалить
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </motion.tr>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Package className="h-12 w-12 text-muted-foreground/50 mb-3" />
                        <p className="font-medium">Нет товаров</p>
                        <p className="text-sm text-muted-foreground mb-4">
                          Добавьте первый товар в каталог
                        </p>
                        <Link href="/dashboard/products/new">
                          <Button data-testid="button-add-first-product">
                            <Plus className="h-4 w-4 mr-2" />
                            Добавить товар
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <AlertDialog open={!!confirmReplace} onOpenChange={(open) => !open && setConfirmReplace(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Заменить приоритетный товар?</AlertDialogTitle>
            <AlertDialogDescription>
              В этой категории уже выбран приоритетный товар: <strong>{confirmReplace?.existingProductName}</strong>. Заменить его на <strong>{confirmReplace?.product.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-replace">Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSetPriority} data-testid="button-confirm-replace">Заменить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!crossSellDialog} onOpenChange={(open) => !open && setCrossSellDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Сопутствующие товары</DialogTitle>
            <DialogDescription>
              AI предложит клиенту эти товары после выбора основного. Выберите до 3 товаров.
            </DialogDescription>
          </DialogHeader>

          {selectedCrossSell.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedCrossSell.map(id => {
                const p = products?.find(pr => pr.id === id);
                return (
                  <Badge key={id} variant="secondary" className="gap-1 pr-1">
                    <span className="max-w-[150px] truncate">{p?.name || id}</span>
                    <button
                      onClick={() => handleToggleCrossSell(id)}
                      className="ml-1 rounded-full p-0.5"
                      data-testid={`remove-cross-sell-${id}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}

          <div className="space-y-3">
            <Input
              placeholder="Поиск товаров..."
              value={crossSellSearch}
              onChange={(e) => setCrossSellSearch(e.target.value)}
              data-testid="input-cross-sell-search"
            />
            <div className="max-h-60 overflow-y-auto space-y-1">
              {products
                ?.filter(p =>
                  p.id !== crossSellDialog?.id &&
                  p.name.toLowerCase().includes(crossSellSearch.toLowerCase())
                )
                .slice(0, 20)
                .map(p => {
                  const isSelected = selectedCrossSell.includes(p.id);
                  const isDisabled = !isSelected && selectedCrossSell.length >= 3;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${isSelected ? "bg-accent" : isDisabled ? "opacity-50" : "hover-elevate"}`}
                      onClick={() => !isDisabled && handleToggleCrossSell(p.id)}
                      data-testid={`cross-sell-item-${p.id}`}
                    >
                      <div className="w-4 h-4 rounded-sm border flex items-center justify-center shrink-0">
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <div className="w-8 h-8 rounded bg-muted overflow-hidden shrink-0">
                        {p.mainImageUrl ? (
                          <img src={resolveImageUrl(p.mainImageUrl)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-3 w-3 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Intl.NumberFormat("ru-KZ").format(parseFloat(p.price))} ₸
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
            {selectedCrossSell.length >= 3 && (
              <p className="text-xs text-muted-foreground">Можно выбрать максимум 3 товара.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCrossSellDialog(null)} data-testid="button-cancel-cross-sell">
              Отмена
            </Button>
            <Button
              onClick={() => crossSellDialog && saveCrossSellMutation.mutate({ productId: crossSellDialog.id, relatedProductIds: selectedCrossSell })}
              disabled={saveCrossSellMutation.isPending}
              data-testid="button-save-cross-sell"
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!upsellDialog} onOpenChange={(open) => !open && setUpsellDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Апселл-товар</DialogTitle>
            <DialogDescription>
              Выберите более дорогой/премиальный товар, который AI предложит клиенту как альтернативу.
            </DialogDescription>
          </DialogHeader>

          {selectedUpsell && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1 pr-1">
                <span className="max-w-[200px] truncate">
                  {products?.find(p => p.id === selectedUpsell)?.name || selectedUpsell}
                </span>
                <button
                  onClick={() => setSelectedUpsell(null)}
                  className="ml-1 rounded-full p-0.5"
                  data-testid="remove-upsell-selection"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </div>
          )}

          <div className="space-y-3">
            <Input
              placeholder="Поиск товаров..."
              value={upsellSearch}
              onChange={(e) => setUpsellSearch(e.target.value)}
              data-testid="input-upsell-search"
            />
            <div className="max-h-60 overflow-y-auto space-y-1">
              {products
                ?.filter(p =>
                  p.id !== upsellDialog?.id &&
                  p.name.toLowerCase().includes(upsellSearch.toLowerCase())
                )
                .slice(0, 20)
                .map(p => {
                  const isSelected = selectedUpsell === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${isSelected ? "bg-accent" : "hover-elevate"}`}
                      onClick={() => setSelectedUpsell(isSelected ? null : p.id)}
                      data-testid={`upsell-item-${p.id}`}
                    >
                      <div className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0">
                        {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <div className="w-8 h-8 rounded bg-muted overflow-hidden shrink-0">
                        {p.mainImageUrl ? (
                          <img src={resolveImageUrl(p.mainImageUrl)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-3 w-3 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Intl.NumberFormat("ru-KZ").format(parseFloat(p.price))} ₸
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {selectedUpsell && (
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() => upsellDialog && removeUpsellMutation.mutate(upsellDialog.id)}
                disabled={removeUpsellMutation.isPending}
                data-testid="button-remove-upsell"
              >
                Убрать
              </Button>
            )}
            <Button variant="outline" onClick={() => setUpsellDialog(null)} data-testid="button-cancel-upsell">
              Отмена
            </Button>
            <Button
              onClick={() => upsellDialog && selectedUpsell && saveUpsellMutation.mutate({ productId: upsellDialog.id, upsellProductId: selectedUpsell })}
              disabled={!selectedUpsell || saveUpsellMutation.isPending}
              data-testid="button-save-upsell"
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
