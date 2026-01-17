import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { AiPaywall } from "@/components/AiPaywall";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Tags, Trash2, ArrowLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface AiTagRule {
  id: string;
  tag: string;
  displayName: string;
  keywordsJson: string[];
  priority: number;
  action: string;
  responseTemplate?: string;
  isEnabled: boolean;
}

const actionLabels: Record<string, string> = {
  none: "Без действия",
  handoff: "Передать человеку",
  notify: "Уведомить менеджера",
  send_catalog_link: "Отправить каталог",
  stop_ai: "Остановить AI",
};

export default function AiTagsPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [tag, setTag] = useState("");
  const [keywords, setKeywords] = useState("");
  const [action, setAction] = useState("none");
  const [priority, setPriority] = useState("20");

  const { data: status } = useQuery<{ hasAccess: boolean; planName?: string }>({
    queryKey: ["/api/ai/status"],
  });

  const { data: tags, isLoading } = useQuery<AiTagRule[]>({
    queryKey: ["/api/ai/tags"],
    enabled: status?.hasAccess,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/ai/tags", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/status"] });
      setOpen(false);
      resetForm();
      toast({ title: "Тег создан" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/ai/tags/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/tags"] });
      toast({ title: "Тег удалён" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      return apiRequest("PUT", `/api/ai/tags/${id}`, { isEnabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/tags"] });
    },
  });

  const resetForm = () => {
    setDisplayName("");
    setTag("");
    setKeywords("");
    setAction("none");
    setPriority("20");
  };

  if (!status?.hasAccess) {
    return <div className="p-6"><AiPaywall currentPlan={status?.planName} /></div>;
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/ai">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Теги диалогов</h1>
            <p className="text-muted-foreground">Автоматическая классификация сообщений и действия по ключевым словам</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-tag">
              <Plus className="mr-2 h-4 w-4" />
              Добавить тег
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый тег</DialogTitle>
              <DialogDescription>Настройте правило классификации диалогов</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Название</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Жалоба" data-testid="input-tag-name" />
              </div>
              <div className="space-y-2">
                <Label>Системный тег</Label>
                <Input value={tag} onChange={(e) => setTag(e.target.value.toLowerCase().replace(/\s+/g, '_'))} placeholder="complaint" data-testid="input-tag-code" />
              </div>
              <div className="space-y-2">
                <Label>Ключевые слова (через запятую)</Label>
                <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="жалоба, плохо, ужас" data-testid="input-tag-keywords" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Действие</Label>
                  <Select value={action} onValueChange={setAction}>
                    <SelectTrigger data-testid="select-tag-action">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(actionLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Приоритет</Label>
                  <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} data-testid="input-tag-priority" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
              <Button
                onClick={() => createMutation.mutate({
                  displayName,
                  tag,
                  keywordsJson: keywords.split(',').map(k => k.trim()).filter(Boolean),
                  action,
                  priority: parseInt(priority),
                })}
                disabled={!displayName || !tag || createMutation.isPending}
                data-testid="button-save-tag"
              >
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tags?.map((rule) => (
          <Card key={rule.id} data-testid={`card-tag-${rule.id}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tags className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">{rule.displayName}</CardTitle>
                </div>
                <Switch
                  checked={rule.isEnabled}
                  onCheckedChange={(checked) => toggleMutation.mutate({ id: rule.id, isEnabled: checked })}
                  data-testid={`switch-tag-${rule.id}`}
                />
              </div>
              <CardDescription className="font-mono text-xs">{rule.tag}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1">
                {rule.keywordsJson?.slice(0, 4).map((kw, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                ))}
                {(rule.keywordsJson?.length || 0) > 4 && (
                  <Badge variant="outline" className="text-xs">+{rule.keywordsJson.length - 4}</Badge>
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{actionLabels[rule.action]}</span>
                <Badge variant="outline">P{rule.priority}</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:text-destructive"
                onClick={() => deleteMutation.mutate(rule.id)}
                disabled={deleteMutation.isPending}
                data-testid={`button-delete-tag-${rule.id}`}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Удалить
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
