import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  Save, Store, MessageCircle, Bell, ExternalLink, Upload, Image, 
  Share2, QrCode, Download, Clock, MapPin, Link2, Copy, Check
} from "lucide-react";
import { z } from "zod";
import QRCode from "qrcode";
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
  slug: z.string().min(1, "Ссылка обязательна").regex(/^[a-z0-9-]+$/, "Только латинские буквы, цифры и дефис"),
  description: z.string().max(500, "Максимум 500 символов").optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  gisLink: z.string().optional(),
  workingHours: z.string().optional(),
  logoUrl: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  ogImageUrl: z.string().optional(),
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
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [ogImagePreview, setOgImagePreview] = useState<string>("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const ogImageInputRef = useRef<HTMLInputElement>(null);

  const { data: tenant, isLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenant"],
  });

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      contactPhone: "",
      contactEmail: "",
      address: "",
      gisLink: "",
      workingHours: "",
      logoUrl: "",
      ogTitle: "",
      ogDescription: "",
      ogImageUrl: "",
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
        slug: tenant.slug,
        description: tenant.description || "",
        contactPhone: tenant.contactPhone || "",
        contactEmail: tenant.contactEmail || "",
        address: tenant.address || "",
        gisLink: (tenant as any).gisLink || "",
        workingHours: (tenant as any).workingHours || "",
        logoUrl: tenant.logoUrl || "",
        ogTitle: (tenant as any).ogTitle || "",
        ogDescription: (tenant as any).ogDescription || "",
        ogImageUrl: (tenant as any).ogImageUrl || "",
        wahaBaseUrl: tenant.wahaBaseUrl || "",
        wahaInstanceName: tenant.wahaInstanceName || "",
        notificationPhone: tenant.notificationPhone || "",
        telegramChatId: tenant.telegramChatId || "",
        aiEnabled: tenant.aiEnabled,
      });
      setLogoPreview(tenant.logoUrl || "");
      setOgImagePreview((tenant as any).ogImageUrl || "");
      generateQRCode(tenant.slug);
    }
  }, [tenant, form]);

  const generateQRCode = async (slug: string) => {
    try {
      const url = `${window.location.origin}/c/${slug}`;
      const qr = await QRCode.toDataURL(url, { 
        width: 256, 
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" }
      });
      setQrCodeUrl(qr);
    } catch (err) {
      console.error("QR generation error:", err);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeUrl || !tenant) return;
    const link = document.createElement("a");
    link.download = `qr-${tenant.slug}.png`;
    link.href = qrCodeUrl;
    link.click();
  };

  const copyLink = () => {
    if (!tenant) return;
    const url = `${window.location.origin}/c/${tenant.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Ссылка скопирована" });
  };

  const handleImageUpload = async (file: File, type: "logo" | "og") => {
    const formData = new FormData();
    formData.append("image", file);
    
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (type === "logo") {
          form.setValue("logoUrl", data.url);
          setLogoPreview(data.url);
        } else {
          form.setValue("ogImageUrl", data.url);
          setOgImagePreview(data.url);
        }
      }
    } catch (err) {
      toast({ title: "Ошибка загрузки изображения", variant: "destructive" });
    }
  };

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
                <div className="flex items-start gap-6">
                  <div className="space-y-2">
                    <Label>Логотип</Label>
                    <div 
                      className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors bg-muted/50"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="w-full h-full object-contain rounded-lg" />
                      ) : (
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, "logo");
                      }}
                    />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Название магазина *</Label>
                      <Input
                        id="name"
                        {...form.register("name")}
                        data-testid="input-store-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slug">Ссылка на каталог</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">/c/</span>
                        <Input
                          id="slug"
                          {...form.register("slug")}
                          placeholder="my-shop"
                          data-testid="input-slug"
                        />
                      </div>
                      {form.formState.errors.slug && (
                        <p className="text-sm text-destructive">{form.formState.errors.slug.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="description">Описание (отображается в подвале каталога)</Label>
                    <span className="text-xs text-muted-foreground">
                      {form.watch("description")?.length || 0}/500
                    </span>
                  </div>
                  <Textarea
                    id="description"
                    rows={3}
                    placeholder="Расскажите о вашем магазине..."
                    maxLength={500}
                    {...form.register("description")}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Телефон (отображается в шапке)</Label>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Адрес (отображается в шапке)</Label>
                    <Input
                      id="address"
                      placeholder="г. Алматы, ул. Примерная, 123"
                      {...form.register("address")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gisLink">Ссылка 2GIS</Label>
                    <Input
                      id="gisLink"
                      placeholder="https://2gis.kz/almaty/..."
                      {...form.register("gisLink")}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workingHours">График работы</Label>
                  <Input
                    id="workingHours"
                    placeholder="Пн-Сб: 10:00-20:00, Вс: выходной"
                    {...form.register("workingHours")}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  Настройки для мессенджеров
                </CardTitle>
                <CardDescription>
                  Как будет выглядеть ссылка при отправке в WhatsApp, Telegram и др.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-6">
                  <div className="space-y-2">
                    <Label>Картинка превью</Label>
                    <div 
                      className="w-32 h-20 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors bg-muted/50"
                      onClick={() => ogImageInputRef.current?.click()}
                    >
                      {ogImagePreview ? (
                        <img src={ogImagePreview} alt="OG Preview" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Image className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <input
                      ref={ogImageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, "og");
                      }}
                    />
                    <p className="text-xs text-muted-foreground">1200×630 рекомендуется</p>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="ogTitle">Заголовок</Label>
                      <Input
                        id="ogTitle"
                        placeholder={form.watch("name") || "Название магазина"}
                        {...form.register("ogTitle")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ogDescription">Описание</Label>
                      <Textarea
                        id="ogDescription"
                        rows={2}
                        placeholder="Краткое описание для превью в мессенджерах..."
                        {...form.register("ogDescription")}
                      />
                    </div>
                  </div>
                </div>
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
                  <QrCode className="h-5 w-5" />
                  QR-код каталога
                </CardTitle>
                <CardDescription>
                  Скачайте QR-код для печати на визитках и рекламе
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  {qrCodeUrl && (
                    <div className="bg-white p-2 rounded-lg shadow-sm">
                      <img src={qrCodeUrl} alt="QR Code" className="w-32 h-32" />
                    </div>
                  )}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={tenant ? `${window.location.origin}/c/${tenant.slug}` : ""}
                        readOnly
                        className="text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={copyLink}
                        data-testid="button-copy-link"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={downloadQRCode}
                      className="gap-2"
                      data-testid="button-download-qr"
                    >
                      <Download className="h-4 w-4" />
                      Скачать QR-код
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
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
