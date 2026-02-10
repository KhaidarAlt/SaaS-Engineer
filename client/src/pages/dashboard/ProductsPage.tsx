import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
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
import { Switch } from "@/components/ui/switch";
import { DashboardLayout } from "@/components/DashboardLayout";
import { TableRowSkeleton } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Product, Category } from "@shared/schema";

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
  const { toast } = useToast();

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
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
                              src={product.mainImageUrl}
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
                          <span>{product.name}</span>
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
    </DashboardLayout>
  );
}
