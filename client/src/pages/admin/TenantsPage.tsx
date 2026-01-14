import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Search,
  Building2,
  MoreHorizontal,
  Eye,
  Ban,
  Play,
  Calendar,
} from "lucide-react";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DashboardLayout } from "@/components/DashboardLayout";
import { TableRowSkeleton } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Tenant, Subscription, Plan } from "@shared/schema";

interface TenantWithDetails extends Tenant {
  subscription?: Subscription & { plan?: Plan };
  ownerEmail?: string;
  daysLeft?: number;
}

export default function TenantsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantWithDetails | null>(null);
  const [extendDays, setExtendDays] = useState("30");
  const [extendReason, setExtendReason] = useState("");
  const { toast } = useToast();

  const { data: tenants, isLoading } = useQuery<TenantWithDetails[]>({
    queryKey: ["/api/admin/tenants"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/admin/tenants/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      toast({ title: "Статус обновлён" });
    },
  });

  const extendSubscriptionMutation = useMutation({
    mutationFn: async ({ tenantId, days, reason }: { tenantId: string; days: number; reason: string }) => {
      return apiRequest("POST", `/api/admin/subscriptions/extend`, {
        tenantId,
        days,
        reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      toast({ title: "Подписка продлена" });
      setExtendDialogOpen(false);
      setExtendDays("30");
      setExtendReason("");
    },
    onError: () => {
      toast({ title: "Ошибка продления", variant: "destructive" });
    },
  });

  const filteredTenants = tenants?.filter((tenant) => {
    const matchesSearch =
      tenant.name.toLowerCase().includes(search.toLowerCase()) ||
      tenant.slug.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || tenant.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return { label: "Активен", variant: "default" as const };
      case "suspended":
        return { label: "Приостановлен", variant: "secondary" as const };
      case "banned":
        return { label: "Заблокирован", variant: "destructive" as const };
      default:
        return { label: status, variant: "outline" as const };
    }
  };

  const openExtendDialog = (tenant: TenantWithDetails) => {
    setSelectedTenant(tenant);
    setExtendDialogOpen(true);
  };

  const handleExtend = () => {
    if (selectedTenant && extendReason.trim()) {
      extendSubscriptionMutation.mutate({
        tenantId: selectedTenant.id,
        days: parseInt(extendDays),
        reason: extendReason,
      });
    }
  };

  return (
    <DashboardLayout isSuperAdmin>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Тенанты</h1>
          <p className="text-muted-foreground">
            Управление бизнесами на платформе
          </p>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по названию или slug..."
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
                  <SelectItem value="active">Активные</SelectItem>
                  <SelectItem value="suspended">Приостановленные</SelectItem>
                  <SelectItem value="banned">Заблокированные</SelectItem>
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
                  <TableHead>Магазин</TableHead>
                  <TableHead>Владелец</TableHead>
                  <TableHead>Тариф</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Подписка до</TableHead>
                  <TableHead>Дней осталось</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => <TableRowSkeleton key={i} cols={7} />)
                ) : filteredTenants && filteredTenants.length > 0 ? (
                  filteredTenants.map((tenant, index) => (
                    <motion.tr
                      key={tenant.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{tenant.name}</p>
                          <p className="text-sm text-muted-foreground">
                            /{tenant.slug}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tenant.ownerEmail || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {tenant.subscription?.plan?.name || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadge(tenant.status).variant}>
                          {getStatusBadge(tenant.status).label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tenant.subscription?.endsAt
                          ? formatDate(tenant.subscription.endsAt)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {tenant.daysLeft !== undefined ? (
                          <span
                            className={
                              tenant.daysLeft <= 7
                                ? "text-destructive font-medium"
                                : ""
                            }
                          >
                            {tenant.daysLeft} дней
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              Подробнее
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openExtendDialog(tenant)}>
                              <Calendar className="h-4 w-4 mr-2" />
                              Продлить подписку
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {tenant.status === "active" ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    id: tenant.id,
                                    status: "suspended",
                                  })
                                }
                              >
                                <Ban className="h-4 w-4 mr-2" />
                                Приостановить
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    id: tenant.id,
                                    status: "active",
                                  })
                                }
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Активировать
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </motion.tr>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Building2 className="h-12 w-12 text-muted-foreground/50 mb-3" />
                        <p className="font-medium">Нет тенантов</p>
                        <p className="text-sm text-muted-foreground">
                          Тенанты появятся после регистрации пользователей
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Продлить подписку</DialogTitle>
              <DialogDescription>
                {selectedTenant?.name} — добавить дней к текущей подписке
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="days">Количество дней</Label>
                <Select value={extendDays} onValueChange={setExtendDays}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 дней</SelectItem>
                    <SelectItem value="14">14 дней</SelectItem>
                    <SelectItem value="30">30 дней</SelectItem>
                    <SelectItem value="60">60 дней</SelectItem>
                    <SelectItem value="90">90 дней</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Причина продления *</Label>
                <Textarea
                  id="reason"
                  placeholder="Укажите причину продления..."
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>
                  Отмена
                </Button>
                <Button
                  onClick={handleExtend}
                  disabled={!extendReason.trim() || extendSubscriptionMutation.isPending}
                >
                  Продлить
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
