import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Search,
  Gift,
  MoreHorizontal,
  Eye,
  CreditCard,
  Phone,
  Store,
  ArrowUpCircle,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
import type { Plan } from "@shared/schema";

interface FreeUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  storeName: string;
  slug: string;
  createdAt: string;
  tenantId: string;
}

export default function UsersFreePageRoute() {
  const [search, setSearch] = useState("");
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<FreeUser | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const { toast } = useToast();

  const { data: users, isLoading } = useQuery<FreeUser[]>({
    queryKey: ["/api/admin/users-free"],
  });

  const { data: plans } = useQuery<Plan[]>({
    queryKey: ["/api/admin/plans"],
  });

  const upgradePlanMutation = useMutation({
    mutationFn: async ({ tenantId, planId }: { tenantId: string; planId: string }) => {
      return apiRequest("POST", `/api/admin/subscriptions/change-plan`, {
        tenantId,
        planId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users-free"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Тариф активирован" });
      setPlanDialogOpen(false);
      setSelectedPlanId("");
    },
    onError: () => {
      toast({ title: "Ошибка активации тарифа", variant: "destructive" });
    },
  });

  const filteredUsers = users?.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.storeName.toLowerCase().includes(search.toLowerCase()) ||
      (user.phone && user.phone.includes(search));
    return matchesSearch;
  });

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const openPlanDialog = (user: FreeUser) => {
    setSelectedUser(user);
    setPlanDialogOpen(true);
  };

  const handleUpgrade = () => {
    if (selectedUser && selectedPlanId) {
      upgradePlanMutation.mutate({
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
          <h1 className="text-2xl font-bold tracking-tight">Пользователи FREE</h1>
          <p className="text-muted-foreground">
            Бесплатные пользователи (тариф "Старт")
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
                  data-testid="input-search-free"
                />
              </div>
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
                  <TableHead>Тариф</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                ) : filteredUsers && filteredUsers.length > 0 ? (
                  filteredUsers.map((user, index) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
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
                        <Badge variant="secondary">
                          <Gift className="h-3 w-3 mr-1" />
                          Старт
                        </Badge>
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
                            <DropdownMenuItem onClick={() => openPlanDialog(user)}>
                              <ArrowUpCircle className="h-4 w-4 mr-2" />
                              Перевести на платный
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </motion.tr>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Gift className="h-12 w-12 text-muted-foreground/50 mb-3" />
                        <p className="font-medium">Нет бесплатных пользователей</p>
                        <p className="text-sm text-muted-foreground">
                          Пользователи на тарифе "Старт" появятся здесь
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Активировать платный тариф</DialogTitle>
              <DialogDescription>
                {selectedUser?.storeName} — перевести на платный тариф
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Выберите тариф</Label>
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите тариф" />
                  </SelectTrigger>
                  <SelectContent>
                    {paidPlans.map((plan) => (
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
                  onClick={handleUpgrade}
                  disabled={upgradePlanMutation.isPending || !selectedPlanId}
                >
                  Активировать
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
