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
  Wand2,
  Bot,
  ShoppingBag,
  Lock,
  Unlock,
  CheckCircle,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DashboardLayout } from "@/components/DashboardLayout";
import { TableRowSkeleton } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Tenant, Subscription, Plan } from "@shared/schema";

interface MagicImportSession {
  id: string;
  tenantId?: string;
  status: string;
}

interface TenantWithDetails extends Tenant {
  subscription?: Subscription & { plan?: Plan };
  ownerEmail?: string;
  daysLeft?: number;
  magicImportSessionId?: string;
}

export default function TenantsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [magicImportOnly, setMagicImportOnly] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantWithDetails | null>(null);
  const [extendDays, setExtendDays] = useState("30");
  const [extendReason, setExtendReason] = useState("");
  const [toggleConfirmOpen, setToggleConfirmOpen] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{ tenantId: string; tenantName: string; field: string; label: string; value: boolean } | null>(null);
  const { toast } = useToast();

  const { data: tenants, isLoading } = useQuery<TenantWithDetails[]>({
    queryKey: ["/api/admin/tenants"],
  });

  const { data: miSessions } = useQuery<MagicImportSession[]>({
    queryKey: ["/api/admin/magic-import/sessions"],
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

  const toggleMutation = useMutation({
    mutationFn: async ({ tenantId, field, value }: { tenantId: string; field: string; value: boolean }) => {
      return apiRequest("PATCH", `/api/admin/tenants/${tenantId}/toggles`, { [field]: value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      toast({ title: "Настройки обновлены" });
    },
    onError: () => {
      toast({ title: "Ошибка обновления", variant: "destructive" });
    },
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return apiRequest("POST", `/api/admin/magic-import/${sessionId}/confirm-payment`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/magic-import/sessions"] });
      toast({ title: "Оплата подтверждена, магазин активирован" });
    },
    onError: () => {
      toast({ title: "Ошибка подтверждения", variant: "destructive" });
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

  const miSessionsByTenant = new Map<string, MagicImportSession>();
  miSessions?.forEach((s) => {
    if (s.tenantId) miSessionsByTenant.set(s.tenantId, s);
  });

  const filteredTenants = tenants?.filter((tenant) => {
    const matchesSearch =
      tenant.name.toLowerCase().includes(search.toLowerCase()) ||
      tenant.slug.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || tenant.status === statusFilter;
    const matchesMI = !magicImportOnly || !!tenant.importSource?.startsWith("telegram:");
    return matchesSearch && matchesStatus && matchesMI;
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
      case "demo":
        return { label: "Демо", variant: "outline" as const };
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
                  <SelectItem value="demo">Демо</SelectItem>
                  <SelectItem value="suspended">Приостановленные</SelectItem>
                  <SelectItem value="banned">Заблокированные</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={magicImportOnly ? "default" : "outline"}
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={() => setMagicImportOnly(!magicImportOnly)}
                data-testid="button-filter-magic-import"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Magic Import
              </Button>
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
                  <TableHead className="text-center">SC</TableHead>
                  <TableHead className="text-center">AI-РОП</TableHead>
                  <TableHead>Подписка до</TableHead>
                  <TableHead>Дней осталось</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => <TableRowSkeleton key={i} cols={9} />)
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
                        <div className="flex items-center gap-1.5">
                          <Badge variant={getStatusBadge(tenant.status).variant}>
                            {getStatusBadge(tenant.status).label}
                          </Badge>
                          {tenant.importSource?.startsWith("telegram:") && (
                            <Badge variant="outline" className="text-[10px] gap-0.5">
                              <Wand2 className="h-2.5 w-2.5" />MI
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {!tenant.smartCatalogEnabled && <Lock className="h-3 w-3 text-muted-foreground" />}
                          <Switch
                            checked={tenant.smartCatalogEnabled !== false}
                            onCheckedChange={(v) => {
                              setPendingToggle({ tenantId: tenant.id, tenantName: tenant.name, field: "smartCatalogEnabled", label: "SmartCatalog", value: v });
                              setToggleConfirmOpen(true);
                            }}
                            data-testid={`toggle-sc-${tenant.id}`}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {!tenant.aiRopEnabled && <Lock className="h-3 w-3 text-muted-foreground" />}
                          <Switch
                            checked={tenant.aiRopEnabled === true}
                            onCheckedChange={(v) => {
                              setPendingToggle({ tenantId: tenant.id, tenantName: tenant.name, field: "aiRopEnabled", label: "AI-РОП", value: v });
                              setToggleConfirmOpen(true);
                            }}
                            data-testid={`toggle-airop-${tenant.id}`}
                          />
                        </div>
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
                            {(() => {
                              const miSession = miSessionsByTenant.get(tenant.id);
                              if (miSession && (miSession.status === "paid_clicked" || tenant.status === "demo" || tenant.status === "suspended")) {
                                return (
                                  <DropdownMenuItem
                                    onClick={() => confirmPaymentMutation.mutate(miSession.id)}
                                    data-testid={`button-confirm-payment-${tenant.id}`}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Подтвердить оплату
                                  </DropdownMenuItem>
                                );
                              }
                              return null;
                            })()}
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
                    <TableCell colSpan={9} className="h-48">
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

        <AlertDialog open={toggleConfirmOpen} onOpenChange={setToggleConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Подтвердите действие</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingToggle?.value
                  ? `Включить ${pendingToggle?.label} для «${pendingToggle?.tenantName}»?`
                  : `Отключить ${pendingToggle?.label} для «${pendingToggle?.tenantName}»?`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => setPendingToggle(null)}
                data-testid="button-toggle-cancel"
              >
                Отмена
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pendingToggle) {
                    toggleMutation.mutate({
                      tenantId: pendingToggle.tenantId,
                      field: pendingToggle.field,
                      value: pendingToggle.value,
                    });
                  }
                  setPendingToggle(null);
                  setToggleConfirmOpen(false);
                }}
                data-testid="button-toggle-confirm"
              >
                Подтвердить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
