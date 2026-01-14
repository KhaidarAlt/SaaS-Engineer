import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Save, Store, MessageCircle, Bell, ExternalLink } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageLoader } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Tenant } from "@shared/schema";

const settingsFormSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  description: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  wahaBaseUrl: z.string().optional(),
  wahaInstanceName: z.string().optional(),
  notificationPhone: z.string().optional(),
  telegramChatId: z.string().optional(),
  aiEnabled: z.boolean(),
});

type SettingsFormData = z.infer<typeof settingsFormSchema>;

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();

  const { data: tenant, isLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenant"],
  });

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      name: "",
      description: "",
      contactPhone: "",
      contactEmail: "",
      address: "",
      wahaBaseUrl: "",
      wahaInstanceName: "",
      notificationPhone: "",
      telegramChatId: "",
      aiEnabled: false,
    },
  });

  useEffect(() => {
    if (tenant) {
      form.reset({
        name: tenant.name,
        description: tenant.description || "",
        contactPhone: tenant.contactPhone || "",
        contactEmail: tenant.contactEmail || "",
        address: tenant.address || "",
        wahaBaseUrl: tenant.wahaBaseUrl || "",
        wahaInstanceName: tenant.wahaInstanceName || "",
        notificationPhone: tenant.notificationPhone || "",
        telegramChatId: tenant.telegramChatId || "",
        aiEnabled: tenant.aiEnabled,
      });
    }
  }, [tenant, form]);

  const mutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      return apiRequest("PUT", "/api/tenant", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant"] });
      refreshUser();
      toast({ title: "Настройки сохранены" });
    },
    onError: () => {
      toast({ title: "Ошибка сохранения", variant: "destructive" });
    },
  });

  const onSubmit = (data: SettingsFormData) => {
    mutation.mutate(data);
  };

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Настройки</h1>
          <p className="text-muted-foreground">
            Настройте параметры вашего магазина
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Информация о магазине
                </CardTitle>
                <CardDescription>
                  Эти данные отображаются в публичном каталоге
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Название магазина *</Label>
                  <Input
                    id="name"
                    {...form.register("name")}
                    data-testid="input-store-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Описание</Label>
                  <Textarea
                    id="description"
                    rows={3}
                    placeholder="Расскажите о вашем магазине..."
                    {...form.register("description")}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Телефон</Label>
                    <Input
                      id="contactPhone"
                      placeholder="+7 (777) 123-45-67"
                      {...form.register("contactPhone")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      placeholder="shop@example.com"
                      {...form.register("contactEmail")}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Адрес</Label>
                  <Input
                    id="address"
                    placeholder="г. Алматы, ул. Примерная, 123"
                    {...form.register("address")}
                  />
                </div>

                {tenant && (
                  <div className="pt-4 flex items-center justify-between border-t">
                    <div>
                      <Label>Ссылка на каталог</Label>
                      <p className="text-sm text-muted-foreground">
                        Поделитесь этой ссылкой с клиентами
                      </p>
                    </div>
                    <a
                      href={`/c/${tenant.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      /c/{tenant.slug}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  WhatsApp (WAHA)
                </CardTitle>
                <CardDescription>
                  Подключите WhatsApp для получения заказов
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Статус подключения</Label>
                    <p className="text-sm text-muted-foreground">
                      {tenant?.wahaStatus === "connected"
                        ? "WhatsApp подключен и готов к работе"
                        : "WhatsApp не подключен"}
                    </p>
                  </div>
                  <Badge
                    variant={
                      tenant?.wahaStatus === "connected" ? "default" : "secondary"
                    }
                  >
                    {tenant?.wahaStatus === "connected" ? "Подключен" : "Не подключен"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wahaBaseUrl">WAHA URL</Label>
                    <Input
                      id="wahaBaseUrl"
                      placeholder="https://waha.example.com"
                      {...form.register("wahaBaseUrl")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wahaInstanceName">Имя инстанса</Label>
                    <Input
                      id="wahaInstanceName"
                      placeholder="default"
                      {...form.register("wahaInstanceName")}
                    />
                  </div>
                </div>

                <Button type="button" variant="outline" disabled>
                  Подключить через QR-код
                </Button>
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
                  <Bell className="h-5 w-5" />
                  Уведомления
                </CardTitle>
                <CardDescription>
                  Настройте каналы получения уведомлений
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="notificationPhone">Телефон для WhatsApp</Label>
                    <Input
                      id="notificationPhone"
                      placeholder="+77771234567"
                      {...form.register("notificationPhone")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telegramChatId">Telegram Chat ID</Label>
                    <Input
                      id="telegramChatId"
                      placeholder="123456789"
                      {...form.register("telegramChatId")}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label htmlFor="aiEnabled">AI-ассистент</Label>
                    <p className="text-sm text-muted-foreground">
                      Включить AI для автоматических ответов
                    </p>
                  </div>
                  <Switch
                    id="aiEnabled"
                    checked={form.watch("aiEnabled")}
                    onCheckedChange={(checked) => form.setValue("aiEnabled", checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="flex justify-end">
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save-settings">
              {mutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                  Сохранение...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Сохранить настройки
                </span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
