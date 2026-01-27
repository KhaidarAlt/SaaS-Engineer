import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link2, Plus, Trash2, GripVertical, ExternalLink, Copy, Check, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { TenantLink, Tenant } from "@shared/schema";

export default function LinksPage() {
  const { toast } = useToast();
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenant"],
  });

  const { data: links = [], isLoading } = useQuery<TenantLink[]>({
    queryKey: ["/api/links"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; url: string }) => {
      return apiRequest("POST", "/api/links", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/links"] });
      setNewTitle("");
      setNewUrl("");
      toast({ title: "Ссылка добавлена" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title?: string; url?: string; isActive?: boolean }) => {
      return apiRequest("PUT", `/api/links/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/links"] });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/links/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/links"] });
      toast({ title: "Ссылка удалена" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) {
      toast({ title: "Заполните все поля", variant: "destructive" });
      return;
    }
    let url = newUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    createMutation.mutate({ title: newTitle.trim(), url });
  };

  const publicUrl = tenant?.slug ? `${window.location.origin}/l/${tenant.slug}` : "";

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast({ title: "Ссылка скопирована" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Не удалось скопировать", variant: "destructive" });
    }
  };

  const addCatalogLink = () => {
    if (!tenant?.slug) return;
    const catalogUrl = `${window.location.origin}/c/${tenant.slug}`;
    createMutation.mutate({ title: `Каталог ${tenant.name}`, url: catalogUrl });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Мои ссылки</h1>
              <p className="text-muted-foreground">
                Создайте страницу с ссылками для Instagram и других соцсетей
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Ваша публичная страница
            </CardTitle>
            <CardDescription>
              Эту ссылку можно разместить в Instagram био
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                value={publicUrl}
                readOnly
                className="font-mono text-sm"
                data-testid="input-public-url"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyToClipboard}
                data-testid="button-copy-url"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                asChild
              >
                <a href={publicUrl} target="_blank" rel="noopener noreferrer" data-testid="link-preview">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Добавить ссылку
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Название кнопки</Label>
                  <Input
                    id="title"
                    placeholder="Каталог магазина ESSEN"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    data-testid="input-link-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    placeholder="https://botfactory.kz/c/essen-almaty"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    data-testid="input-link-url"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-add-link"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Добавить
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addCatalogLink}
                  disabled={createMutation.isPending}
                  data-testid="button-add-catalog"
                >
                  Добавить ссылку на каталог
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ваши ссылки</CardTitle>
            <CardDescription>
              {links.length === 0 
                ? "Добавьте первую ссылку для вашей страницы"
                : `${links.length} ссылок`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {links.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Нет ссылок</p>
                <p className="text-sm">Добавьте первую ссылку выше</p>
              </div>
            ) : (
              <div className="space-y-3">
                {links.map((link, index) => (
                  <motion.div
                    key={link.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-3 p-3 border rounded-lg hover-elevate"
                    data-testid={`link-item-${link.id}`}
                  >
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{link.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{link.url}</p>
                    </div>
                    <Switch
                      checked={link.isActive}
                      onCheckedChange={(checked) => updateMutation.mutate({ id: link.id, isActive: checked })}
                      data-testid={`switch-link-${link.id}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(link.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${link.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
