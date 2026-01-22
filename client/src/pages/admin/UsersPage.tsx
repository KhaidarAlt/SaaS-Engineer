import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Search,
  Users,
  MoreHorizontal,
  Eye,
  Ban,
  Play,
  Calendar,
  CreditCard,
  Phone,
  Store,
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
import { DashboardLayout } from "@/components/DashboardLayout";
import { TableRowSkeleton } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Plan } from "@shared/schema";

interface UserWithDetails {
  id: string;
  name: string;
  email: string;
  phone?: string;
  storeName: string;
  slug: string;
  status: string;
  planName: string;
  planId: string;
  requestedPlanName?: string;
  requestedPlanId?: string;
  daysLeft: number;
  subscriptionEndsAt?: string;
  createdAt: string;
  tenantId: string;
}

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const [extendDays, setExtendDays] = useState("30");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const { toast } = useToast();

  const { data: users, isLoading } = useQuery<UserWithDetails[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: plans } = useQuery<Plan[]>({
    queryKey: ["/api/admin/plans"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ tenantId, status }: { tenantId: string; status: string }) => {
      return apiRequest("PATCH", `/api/admin/tenants/${tenantId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Статус обновлён" });
    },
  });

  const extendSubscriptionMutation = useMutation({
    mutationFn: async ({ tenantId, days }: { tenantId: string; days: number }) => {
      return apiRequest("POST", `/api/admin/subscriptions/extend`, {
        tenantId,
        days,
        reason: "Ручное продление администратором",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Подписка продлена" });
      setExtendDialogOpen(false);
      setExtendDays("30");
    },
    onError: () => {
      toast({ title: "Ошибка продления", variant: "destructive" });
    },
  });

  const changePlanMutation = useMutation({
    mutationFn: async ({ tenantId, planId }: { tenantId: string; planId: string }) => {
      return apiRequest("POST", `/api/admin/subscriptions/change-plan`, {
        tenantId,
        planId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Тариф изменён" });
      setPlanDialogOpen(false);
      setSelectedPlanId("");
    },
    onError: () => {
      toast({ title: "Ошибка смены тарифа", variant: "destructive" });
    },
  });

  const filteredUsers = users
    ?.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase()) ||
        user.storeName.toLowerCase().includes(search.toLowerCase()) ||
        (user.phone && user.phone.includes(search));
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    ?.sort((a, b) => {
      if (a.daysLeft <= 14 && b.daysLeft > 14) return -1;
      if (a.daysLeft > 14 && b.daysLeft <= 14) return 1;
      return a.daysLeft - b.daysLeft;
    });

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string, requestedPlanName?: string) => {
    if (requestedPlanName) {
      return { label: `Запрос: ${requestedPlanName}`, variant: "secondary" as const };
    }
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

  const getDaysLeftBadge = (days: number) => {
    if (days <= 0) return { label: "Истёк", className: "bg-destructive text-destructive-foreground" };
    if (days <= 7) return { label: `${days} дней`, className: "bg-destructive text-destructive-foreground" };
    if (days <= 14) return { label: `${days} дней`, className: "bg-orange-500 text-white" };
    return { label: `${days} дней`, className: "" };
  };

  const openExtendDialog = (user: UserWithDetails) => {
    setSelectedUser(user);
    setExtendDialogOpen(true);
  };

  const openPlanDialog = (user: UserWithDetails) => {
    setSelectedUser(user);
    setSelectedPlanId(user.planId);
    setPlanDialogOpen(true);
  };

  const handleExtend = () => {
    if (selectedUser) {
      extendSubscriptionMutation.mutate({
        tenantId: selectedUser.tenantId,
        days: parseInt(extendDays),
      });
    }
  };

  const handleChangePlan = () => {
    if (selectedUser && selectedPlanId) {
      changePlanMutation.mutate({
        tenantId: selectedUser.tenantId,
        planId: selectedPlanId,
      });
    }
  };

  const paidPlans = plans?.filter(p => p.price > 0) || [];

  return (
    <DashboardLayout isSuperAdmin>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Пользователи</h1>
          <p className="text-muted-foreground">
            Управление пользователями платформы
          </p>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по имени, email, телефону, магазину..."
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
                  <TableHead>Имя</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Дата рег.</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Дней осталось</TableHead>
                  <TableHead>Тариф</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => <TableRowSkeleton key={i} cols={8} />)
                ) : filteredUsers && filteredUsers.length > 0 ? (
                  filteredUsers.map((user, index) => {
                    const daysLeftBadge = getDaysLeftBadge(user.daysLeft);
                    const statusBadge = getStatusBadge(user.status, user.requestedPlanName);
                    return (
                      <motion.tr
                        key={user.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.03 }}
                        className={user.daysLeft <= 14 ? "bg-orange-50 dark:bg-orange-950/20" : ""}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{user.storeName}</p>
                              <p className="text-sm text-muted-foreground">/{user.slug}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.phone ? (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{user.phone}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(user.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadge.variant}>
                            {statusBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={daysLeftBadge.className}>
                            {daysLeftBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.planName}</Badge>
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
                                Открыть каталог
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openExtendDialog(user)}>
                                <Calendar className="h-4 w-4 mr-2" />
                                Продлить подписку
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openPlanDialog(user)}>
                                <CreditCard className="h-4 w-4 mr-2" />
                                Изменить тариф
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {user.status === "active" ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      tenantId: user.tenantId,
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
                                      tenantId: user.tenantId,
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
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Users className="h-12 w-12 text-muted-foreground/50 mb-3" />
                        <p className="font-medium">Нет пользователей</p>
                        <p className="text-sm text-muted-foreground">
                          Пользователи появятся после регистрации
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
                {selectedUser?.storeName} — добавить дней к текущей подписке
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="days">Срок продления</Label>
                <Select value={extendDays} onValueChange={setExtendDays}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 дней</SelectItem>
                    <SelectItem value="14">14 дней</SelectItem>
                    <SelectItem value="30">1 месяц (30 дней)</SelectItem>
                    <SelectItem value="60">2 месяца (60 дней)</SelectItem>
                    <SelectItem value="90">3 месяца (90 дней)</SelectItem>
                    <SelectItem value="120">4 месяца (120 дней)</SelectItem>
                    <SelectItem value="150">5 месяцев (150 дней)</SelectItem>
                    <SelectItem value="180">6 месяцев (180 дней)</SelectItem>
                    <SelectItem value="210">7 месяцев (210 дней)</SelectItem>
                    <SelectItem value="240">8 месяцев (240 дней)</SelectItem>
                    <SelectItem value="270">9 месяцев (270 дней)</SelectItem>
                    <SelectItem value="300">10 месяцев (300 дней)</SelectItem>
                    <SelectItem value="330">11 месяцев (330 дней)</SelectItem>
                    <SelectItem value="365">12 месяцев (365 дней)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>
                  Отмена
                </Button>
                <Button
                  onClick={handleExtend}
                  disabled={extendSubscriptionMutation.isPending}
                >
                  Продлить
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Изменить тариф</DialogTitle>
              <DialogDescription>
                {selectedUser?.storeName} — текущий тариф: {selectedUser?.planName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Новый тариф</Label>
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите тариф" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans?.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} — {plan.price.toLocaleString()} ₸/мес
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>
                  Отмена
                </Button>
                <Button
                  onClick={handleChangePlan}
                  disabled={changePlanMutation.isPending || !selectedPlanId}
                >
                  Сохранить
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
