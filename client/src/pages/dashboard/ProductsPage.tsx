import { useState } from "react";
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
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardLayout } from "@/components/DashboardLayout";
import { TableRowSkeleton } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Product, Category } from "@shared/schema";

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

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/products/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Статус обновлён" });
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

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat("ru-KZ").format(parseFloat(price)) + " ₸";
  };

  const getStockStatus = (product: Product) => {
    if (product.alwaysInStock) {
      return { label: "Всегда в наличии", variant: "default" as const };
    }
    if (product.stockQty > 0) {
      return { label: `${product.stockQty} шт.`, variant: "secondary" as const };
    }
    return { label: "Нет в наличии", variant: "destructive" as const };
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
                      className="group"
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
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-muted-foreground">{product.sku}</TableCell>
                      <TableCell>
                        {categories?.find((c) => c.id === product.categoryId)?.name || "—"}
                      </TableCell>
                      <TableCell className="font-medium">{formatPrice(product.price)}</TableCell>
                      <TableCell>
                        <Badge variant={getStockStatus(product).variant}>
                          {getStockStatus(product).label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.isActive ? "default" : "secondary"}>
                          {product.isActive ? "Активен" : "Скрыт"}
                        </Badge>
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
                                toggleActiveMutation.mutate({
                                  id: product.id,
                                  isActive: !product.isActive,
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
