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
import { Plus, BookOpen, Trash2, Edit, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";

interface AiKnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category?: string;
  tagsJson?: string[];
  isPublished: boolean;
  updatedAt: string;
}

export default function AiKnowledgePage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");

  const { data: status } = useQuery<{ hasAccess: boolean; planName?: string }>({
    queryKey: ["/api/ai/status"],
  });

  const { data: articles, isLoading } = useQuery<AiKnowledgeArticle[]>({
    queryKey: ["/api/ai/knowledge"],
    enabled: status?.hasAccess,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingId) {
        return apiRequest("PUT", `/api/ai/knowledge/${editingId}`, data);
      }
      return apiRequest("POST", "/api/ai/knowledge", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/knowledge"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/status"] });
      setOpen(false);
      resetForm();
      toast({ title: editingId ? "Статья обновлена" : "Статья создана" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/ai/knowledge/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/knowledge"] });
      toast({ title: "Статья удалена" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      return apiRequest("PUT", `/api/ai/knowledge/${id}`, { isPublished });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/knowledge"] });
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setContent("");
    setCategory("");
    setTags("");
  };

  const openEdit = (article: AiKnowledgeArticle) => {
    setEditingId(article.id);
    setTitle(article.title);
    setContent(article.content);
    setCategory(article.category || "");
    setTags(article.tagsJson?.join(", ") || "");
    setOpen(true);
  };

  if (!status?.hasAccess) {
    return <DashboardLayout><div className="p-6"><AiPaywall currentPlan={status?.planName} /></div></DashboardLayout>;
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/ai">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">База знаний</h1>
            <p className="text-muted-foreground">Информация, которую AI использует для ответов клиентам</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-article">
              <Plus className="mr-2 h-4 w-4" />
              Добавить статью
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Редактировать статью" : "Новая статья"}</DialogTitle>
              <DialogDescription>Добавьте информацию для AI-ассистента</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Заголовок</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Как оформить заказ" data-testid="input-article-title" />
              </div>
              <div className="space-y-2">
                <Label>Содержание</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Подробное описание..."
                  className="min-h-[200px]"
                  data-testid="input-article-content"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Категория</Label>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Заказы" data-testid="input-article-category" />
                </div>
                <div className="space-y-2">
                  <Label>Теги (через запятую)</Label>
                  <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="заказ, оплата" data-testid="input-article-tags" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
              <Button
                onClick={() => createMutation.mutate({
                  title,
                  content,
                  category: category || null,
                  tagsJson: tags.split(',').map(t => t.trim()).filter(Boolean),
                  isPublished: true,
                })}
                disabled={!title || !content || createMutation.isPending}
                data-testid="button-save-article"
              >
                {editingId ? "Сохранить" : "Создать"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {articles?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Нет статей</p>
            <p className="text-muted-foreground text-sm">Добавьте информацию о товарах, услугах и процессах</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {articles?.map((article) => (
            <Card key={article.id} data-testid={`card-article-${article.id}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">{article.title}</CardTitle>
                    {article.category && <Badge variant="outline">{article.category}</Badge>}
                    <Badge variant={article.isPublished ? "default" : "secondary"}>
                      {article.isPublished ? <><Eye className="mr-1 h-3 w-3" />Опубликована</> : <><EyeOff className="mr-1 h-3 w-3" />Черновик</>}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={article.isPublished}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: article.id, isPublished: checked })}
                    />
                    <Button variant="ghost" size="icon" onClick={() => openEdit(article)} data-testid={`button-edit-${article.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => deleteMutation.mutate(article.id)}
                      data-testid={`button-delete-${article.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  Обновлено: {new Date(article.updatedAt).toLocaleDateString("ru-RU")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">{article.content}</p>
                {article.tagsJson && article.tagsJson.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {article.tagsJson.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}
