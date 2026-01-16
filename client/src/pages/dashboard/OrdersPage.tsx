import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Search,
  ShoppingCart,
  Eye,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardLayout } from "@/components/DashboardLayout";
import { TableRowSkeleton } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Order } from "@shared/schema";

const statusOptions = [
  { value: "new", label: "Новый", variant: "default" as const },
  { value: "in_progress", label: "В работе", variant: "secondary" as const },
  { value: "completed", label: "Выполнен", variant: "outline" as const },
  { value: "cancelled", label: "Отменён", variant: "destructive" as const },
];

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/orders/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Статус обновлён" });
    },
  });

  const filteredOrders = orders?.filter((order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      order.customerName.toLowerCase().includes(search.toLowerCase()) ||
      order.customerPhone.includes(search);
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat("ru-KZ").format(parseFloat(price)) + " ₸";
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const option = statusOptions.find((s) => s.value === status);
    return option || { label: status, variant: "secondary" as const };
  };

  const formatPhoneForWhatsApp = (phone: string) => {
    // Remove all non-digit characters
    let digits = phone.replace(/\D/g, "");
    // If starts with 8, replace with 7 (Kazakhstan/Russia format)
    if (digits.startsWith("8") && digits.length === 11) {
      digits = "7" + digits.slice(1);
    }
    // If no country code, assume Kazakhstan (+7)
    if (digits.length === 10) {
      digits = "7" + digits;
    }
    return digits;
  };

  const createWhatsAppLink = (order: Order) => {
    const phone = formatPhoneForWhatsApp(order.customerPhone);
    const message = encodeURIComponent(
      `Здравствуйте, ${order.customerName}!\n\n` +
      `Ваш заказ #${order.orderNumber} на сумму ${formatPrice(order.total)} принят.\n\n` +
      `Спасибо за заказ!`
    );
    return `https://wa.me/${phone}?text=${message}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Заказы</h1>
          <p className="text-muted-foreground">Управляйте заказами клиентов</p>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по номеру, имени или телефону..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48" data-testid="select-status">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
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
                  <TableHead>Номер</TableHead>
                  <TableHead>Клиент</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => <TableRowSkeleton key={i} cols={7} />)
                ) : filteredOrders && filteredOrders.length > 0 ? (
                  filteredOrders.map((order, index) => (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="group"
                    >
                      <TableCell className="font-medium">
                        <button
                          onClick={() => navigate(`/dashboard/orders/${order.id}`)}
                          className="hover:underline text-primary cursor-pointer"
                          data-testid={`link-order-${order.id}`}
                        >
                          #{order.orderNumber}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.customerName}</p>
                          <p className="text-sm text-muted-foreground">
                            {order.customerPhone}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatPrice(order.total)}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={order.status}
                          onValueChange={(status) =>
                            updateStatusMutation.mutate({ id: order.id, status })
                          }
                        >
                          <SelectTrigger className="w-32 h-8">
                            <Badge variant={getStatusBadge(order.status).variant}>
                              {getStatusBadge(order.status).label}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => window.open(createWhatsAppLink(order), "_blank")}
                          data-testid={`whatsapp-order-${order.id}`}
                        >
                          <SiWhatsapp className="h-4 w-4 text-green-600" />
                          Написать
                        </Button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(order.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/dashboard/orders/${order.id}`)}
                          data-testid={`view-order-${order.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </motion.tr>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48">
                      <div className="flex flex-col items-center justify-center text-center">
                        <ShoppingCart className="h-12 w-12 text-muted-foreground/50 mb-3" />
                        <p className="font-medium">Нет заказов</p>
                        <p className="text-sm text-muted-foreground">
                          Заказы появятся здесь после оформления клиентами
                        </p>
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
