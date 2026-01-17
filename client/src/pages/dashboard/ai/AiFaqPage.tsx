import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { AiPaywall } from "@/components/AiPaywall";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, HelpCircle, Trash2, Edit, GripVertical } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AiFaqItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
  sortOrder: number;
  isPublished: boolean;
}

export default function AiFaqPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("");

  const { data: status } = useQuery<{ hasAccess: boolean; planName?: string }>({
    queryKey: ["/api/ai/status"],
  });

  const { data: items, isLoading } = useQuery<AiFaqItem[]>({
    queryKey: ["/api/ai/faq"],
    enabled: status?.hasAccess,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingId) {
        return apiRequest("PUT", `/api/ai/faq/${editingId}`, data);
      }
      return apiRequest("POST", "/api/ai/faq", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/faq"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/status"] });
      setOpen(false);
      resetForm();
      toast({ title: editingId ? "FAQ обновлён" : "FAQ добавлен" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/ai/faq/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/faq"] });
      toast({ title: "FAQ удалён" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      return apiRequest("PUT", `/api/ai/faq/${id}`, { isPublished });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/faq"] });
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setQuestion("");
    setAnswer("");
    setCategory("");
  };

  const openEdit = (item: AiFaqItem) => {
    setEditingId(item.id);
    setQuestion(item.question);
    setAnswer(item.answer);
    setCategory(item.category || "");
    setOpen(true);
  };

  if (!status?.hasAccess) {
    return <div className="p-6"><AiPaywall currentPlan={status?.planName} /></div>;
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const publishedCount = items?.filter(i => i.isPublished).length || 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">FAQ</h1>
          <p className="text-muted-foreground">
            Часто задаваемые вопросы ({publishedCount} опубликовано, минимум 5 для полной настройки)
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-faq">
              <Plus className="mr-2 h-4 w-4" />
              Добавить FAQ
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Редактировать FAQ" : "Новый FAQ"}</DialogTitle>
              <DialogDescription>Добавьте вопрос и ответ для AI-ассистента</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Вопрос</Label>
                <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Как оформить заказ?" data-testid="input-faq-question" />
              </div>
              <div className="space-y-2">
                <Label>Ответ</Label>
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Для оформления заказа..."
                  className="min-h-[120px]"
                  data-testid="input-faq-answer"
                />
              </div>
              <div className="space-y-2">
                <Label>Категория (необязательно)</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Заказы" data-testid="input-faq-category" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
              <Button
                onClick={() => createMutation.mutate({
                  question,
                  answer,
                  category: category || null,
                  isPublished: true,
                  sortOrder: items?.length || 0,
                })}
                disabled={!question || !answer || createMutation.isPending}
                data-testid="button-save-faq"
              >
                {editingId ? "Сохранить" : "Создать"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {items?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <HelpCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Нет FAQ</p>
            <p className="text-muted-foreground text-sm">Добавьте минимум 5 часто задаваемых вопросов</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items?.map((item, index) => (
            <Card key={item.id} data-testid={`card-faq-${item.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <GripVertical className="h-5 w-5" />
                    <span className="text-sm font-medium">{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{item.question}</p>
                      {item.category && <Badge variant="outline" className="text-xs">{item.category}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.answer}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={item.isPublished}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: item.id, isPublished: checked })}
                    />
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)} data-testid={`button-edit-faq-${item.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => deleteMutation.mutate(item.id)}
                      data-testid={`button-delete-faq-${item.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
