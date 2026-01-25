import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Search,
  FileText,
  CheckCircle,
  XCircle,
  Calendar,
  Store,
  Mail,
  Phone,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DashboardLayout } from "@/components/DashboardLayout";
import { TableRowSkeleton } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface PlanRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  phone?: string;
  storeName: string;
  slug: string;
  currentPlanName: string;
  currentPlanId: string;
  requestedPlanName: string;
  requestedPlanId: string;
  requestedPlanPrice: number;
  createdAt: string;
  tenantId: string;
  subscriptionId: string;
}

const DURATION_OPTIONS = [
  { value: 7, label: "7 дней" },
  { value: 14, label: "14 дней" },
  { value: 30, label: "1 месяц" },
  { value: 90, label: "3 месяца" },
  { value: 180, label: "6 месяцев" },
  { value: 365, label: "1 год" },
];

export default function PlanRequestsPage() {
  const [search, setSearch] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<PlanRequest | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const { toast } = useToast();

  const { data: requests, isLoading } = useQuery<PlanRequest[]>({
    queryKey: ["/api/admin/plan-requests"],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ subscriptionId, planId, durationDays }: { 
      subscriptionId: string; 
      planId: string; 
      durationDays: number; 
    }) => {
      return apiRequest("POST", "/api/admin/plan-requests/approve", { 
        subscriptionId, 
        planId, 
        durationDays 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plan-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Тариф активирован" });
      setShowApproveDialog(false);
      setSelectedRequest(null);
    },
    onError: () => {
      toast({ title: "Ошибка активации тарифа", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      return apiRequest("POST", "/api/admin/plan-requests/reject", { subscriptionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plan-requests"] });
      toast({ title: "Заявка отклонена" });
    },
    onError: () => {
      toast({ title: "Ошибка отклонения заявки", variant: "destructive" });
    },
  });

  const filteredRequests = requests?.filter((req) => {
    const searchLower = search.toLowerCase();
    return (
      req.userName.toLowerCase().includes(searchLower) ||
      req.userEmail.toLowerCase().includes(searchLower) ||
      req.storeName.toLowerCase().includes(searchLower)
    );
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ru-RU").format(price) + " ₸";
  };

  const handleApprove = (request: PlanRequest) => {
    setSelectedRequest(request);
    setSelectedDuration(30);
    setShowApproveDialog(true);
  };

  const confirmApprove = () => {
    if (!selectedRequest) return;
    approveMutation.mutate({
      subscriptionId: selectedRequest.subscriptionId,
      planId: selectedRequest.requestedPlanId,
      durationDays: selectedDuration,
    });
  };

  return (
    <DashboardLayout isSuperAdmin>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Заявки на тариф</h1>
          <p className="text-muted-foreground">
            Пользователи, запросившие платные тарифы
          </p>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по имени, email или магазину..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-requests"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Пользователь</TableHead>
                  <TableHead>Магазин</TableHead>
                  <TableHead>Текущий тариф</TableHead>
                  <TableHead>Запрошенный тариф</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                ) : filteredRequests && filteredRequests.length > 0 ? (
                  filteredRequests.map((request, index) => (
                    <motion.tr
                      key={request.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      className="bg-amber-50 dark:bg-amber-950/20"
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{request.userName}</div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {request.userEmail}
                          </div>
                          {request.phone && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {request.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Store className="h-3 w-3 text-muted-foreground" />
                          <span>{request.storeName}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">/{request.slug}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{request.currentPlanName}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-primary text-primary-foreground">
                          {request.requestedPlanName}
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatPrice(request.requestedPlanPrice)}/мес
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(request.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApprove(request)}
                            data-testid={`button-approve-${request.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Одобрить
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => rejectMutation.mutate(request.subscriptionId)}
                            data-testid={`button-reject-${request.id}`}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Отклонить
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48">
                      <div className="flex flex-col items-center justify-center text-center">
                        <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
                        <p className="font-medium">Нет заявок на тариф</p>
                        <p className="text-sm text-muted-foreground">
                          Заявки появятся когда пользователи запросят платный тариф
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

      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Активировать тариф</DialogTitle>
            <DialogDescription>
              Выберите срок действия тарифа для {selectedRequest?.userName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Тариф</div>
              <div className="flex items-center gap-2">
                <Badge className="bg-primary text-primary-foreground">
                  {selectedRequest?.requestedPlanName}
                </Badge>
                <span className="text-muted-foreground">
                  {selectedRequest && formatPrice(selectedRequest.requestedPlanPrice)}/мес
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium">Срок действия</div>
              <Select 
                value={selectedDuration.toString()} 
                onValueChange={(v) => setSelectedDuration(parseInt(v))}
              >
                <SelectTrigger data-testid="select-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Отмена
            </Button>
            <Button 
              onClick={confirmApprove}
              disabled={approveMutation.isPending}
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending ? "Активация..." : "Активировать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
