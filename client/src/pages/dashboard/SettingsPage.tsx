import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { 
  Save, Store, MessageCircle, Bell, ExternalLink, Upload, Image, 
  Share2, QrCode, Download, Clock, MapPin, Link2, Copy, Check, 
  Loader2, Phone, Trash2, CheckCircle, AlertCircle, RefreshCw, Lock
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { z } from "zod";
import QRCodeLib from "qrcode";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  notificationPhone: z.string().optional(),
  telegramChatId: z.string().optional(),
});

type SettingsFormData = z.infer<typeof settingsFormSchema>;

interface WahaInstance {
  id: string;
  instanceName: string;
  phoneNumber: string | null;
  status: string;
  createdAt: string;
}

const wahaStatusLabels: Record<string, string> = {
  created: "Создан",
  starting: "Запуск...",
  running: "Подключен",
  stopped: "Остановлен",
  failed: "Ошибка",
  scan_qr: "Ожидает сканирования",
  unknown: "Неизвестно",
};

const wahaStatusColors: Record<string, string> = {
  running: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  scan_qr: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  starting: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  stopped: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  created: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
  unknown: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
};

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [ogImagePreview, setOgImagePreview] = useState<string>("");
  const [showWhatsAppQr, setShowWhatsAppQr] = useState(false);
  const [currentInstance, setCurrentInstance] = useState<WahaInstance | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const ogImageInputRef = useRef<HTMLInputElement>(null);

  const { data: tenant, isLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenant"],
  });

  const { data: billing } = useQuery<{ subscription: { plan: { name: string } } }>({
    queryKey: ["/api/billing"],
  });

  const currentPlanName = billing?.subscription?.plan?.name || "";
  const isWahaLocked = currentPlanName === "Старт";

  const { data: wahaInstances, refetch: refetchWahaInstances } = useQuery<WahaInstance[]>({
    queryKey: ["/api/waha/instances"],
    refetchInterval: showWhatsAppQr ? 3000 : 10000,
  });

  const connectedInstance = wahaInstances?.find(i => i.status === "running");
  const pendingInstance = wahaInstances?.find(i => i.status === "scan_qr" || i.status === "starting");

  useEffect(() => {
    if (pendingInstance && !currentInstance) {
      setCurrentInstance(pendingInstance);
      setShowWhatsAppQr(true);
    }
    if (connectedInstance && showWhatsAppQr) {
      setShowWhatsAppQr(false);
      setCurrentInstance(null);
      toast({ title: "WhatsApp успешно подключен!" });
    }
  }, [pendingInstance, connectedInstance, currentInstance, showWhatsAppQr]);

  const { data: wahaQr, refetch: refetchWahaQr } = useQuery<{ qrCode: string }>({
    queryKey: ["/api/waha/instances", currentInstance?.id || "none", "qr"],
    enabled: !!currentInstance?.id && showWhatsAppQr,
    refetchInterval: showWhatsAppQr && !!currentInstance?.id ? 5000 : false,
  });

  const { data: wahaStatus, refetch: refetchWahaStatus } = useQuery<WahaInstance>({
    queryKey: ["/api/waha/instances", currentInstance?.id || "none", "status"],
    enabled: !!currentInstance?.id && showWhatsAppQr,
    refetchInterval: showWhatsAppQr && !!currentInstance?.id ? 3000 : false,
  });

  useEffect(() => {
    if (wahaStatus?.status === "running") {
      setShowWhatsAppQr(false);
      setCurrentInstance(null);
      toast({ title: "WhatsApp успешно подключен!" });
      refetchWahaInstances();
    }
  }, [wahaStatus?.status]);

  const createWahaMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/waha/instances");
      return res.json();
    },
    onSuccess: (data: WahaInstance) => {
      queryClient.invalidateQueries({ queryKey: ["/api/waha/instances"] });
      setCurrentInstance(data);
      setShowWhatsAppQr(true);
      toast({ title: "Сканируйте QR-код в WhatsApp" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const deleteWahaMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/waha/instances/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waha/instances"] });
      setShowWhatsAppQr(false);
      setCurrentInstance(null);
      toast({ title: "WhatsApp отключен" });
    },
    onError: () => {
      toast({ title: "Ошибка отключения", variant: "destructive" });
    },
  });

  const syncWebhookMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/waha/instances/${id}/sync-webhook`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waha/instances"] });
      toast({ title: "Webhook синхронизирован", description: "Теперь AI будет получать сообщения" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка синхронизации", description: error.message, variant: "destructive" });
    },
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
      notificationPhone: "",
      telegramChatId: "",
      aiEnabled: false,
      aiLanguage: "ru",
      aiSystemPrompt: "",
      aiTypingDelay: 0,
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
        notificationPhone: tenant.notificationPhone || "",
        telegramChatId: tenant.telegramChatId || "",
        aiEnabled: tenant.aiEnabled,
        aiLanguage: (tenant as any).aiLanguage || "ru",
        aiSystemPrompt: (tenant as any).aiSystemPrompt || "",
        aiTypingDelay: (tenant as any).aiTypingDelay || 0,
      });
      setLogoPreview(tenant.logoUrl || "");
      setOgImagePreview((tenant as any).ogImageUrl || "");
      generateQRCode(tenant.slug, tenant.updatedAt);
    }
  }, [tenant, form]);

  const generateQRCode = async (slug: string, updatedAt?: string | Date) => {
    try {
      // Add version param based on updatedAt for cache busting in messengers
      const version = updatedAt ? new Date(updatedAt).getTime() : Date.now();
      const url = `${window.location.origin}/c/${slug}?v=${version}`;
      const qr = await QRCodeLib.toDataURL(url, { 
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
    // Add version param for cache busting in messengers
    const version = tenant.updatedAt ? new Date(tenant.updatedAt).getTime() : Date.now();
    const url = `${window.location.origin}/c/${tenant.slug}?v=${version}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Ссылка скопирована" });
  };

  const handleImageUpload = async (file: File, type: "logo" | "og") => {
    try {
      const urlResponse = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: `${type}_${Date.now()}.${file.name.split('.').pop() || 'jpg'}`,
          size: file.size,
          contentType: file.type || "image/jpeg",
        }),
      });
      
      if (!urlResponse.ok) {
        throw new Error("Failed to get upload URL");
      }
      
      const { uploadURL, objectPath } = await urlResponse.json();
      
      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "image/jpeg" },
      });
      
      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }
      
      await fetch("/api/uploads/set-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ objectPath }),
      });
      
      const imageUrl = objectPath;
      
      if (type === "logo") {
        form.setValue("logoUrl", imageUrl);
        setLogoPreview(imageUrl);
      } else {
        form.setValue("ogImageUrl", imageUrl);
        setOgImagePreview(imageUrl);
      }
      
      toast({ title: "Изображение загружено" });
    } catch (err) {
      console.error("Image upload error:", err);
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
                        value={tenant ? `${window.location.origin}/c/${tenant.slug}?v=${tenant.updatedAt ? new Date(tenant.updatedAt).getTime() : Date.now()}` : ""}
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
            <Card data-testid="card-whatsapp-settings">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <SiWhatsapp className={`h-5 w-5 ${isWahaLocked ? "text-muted-foreground" : "text-green-600"}`} />
                  WhatsApp (WAHA)
                  {isWahaLocked && <Lock className="h-4 w-4 text-muted-foreground ml-auto" />}
                </CardTitle>
                <CardDescription>
                  {isWahaLocked 
                    ? "Доступно на платных тарифах" 
                    : "Подключите WhatsApp для получения заказов"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isWahaLocked ? (
                  <div className="p-6 text-center border rounded-lg bg-muted/50">
                    <Lock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="font-medium mb-1">Функция недоступна</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Вам нужно апгрейдить ваш тариф в настройках
                    </p>
                    <Link href="/dashboard/billing">
                      <Button variant="outline" data-testid="button-waha-upgrade">
                        Перейти в биллинг
                      </Button>
                    </Link>
                  </div>
                ) : connectedInstance ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50 dark:bg-green-950">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">WhatsApp подключен</p>
                          <p className="text-sm text-muted-foreground">
                            {connectedInstance.phoneNumber 
                              ? `+${connectedInstance.phoneNumber}` 
                              : connectedInstance.instanceName}
                          </p>
                        </div>
                      </div>
                      <Badge className={wahaStatusColors.running}>
                        {wahaStatusLabels.running}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => syncWebhookMutation.mutate(connectedInstance.id)}
                        disabled={syncWebhookMutation.isPending}
                        className="flex-1"
                        data-testid="button-sync-webhook"
                      >
                        {syncWebhookMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Синхронизировать
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => deleteWahaMutation.mutate(connectedInstance.id)}
                        disabled={deleteWahaMutation.isPending}
                        className="flex-1 text-destructive hover:text-destructive"
                        data-testid="button-disconnect-whatsapp"
                      >
                        {deleteWahaMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        Отключить
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Если AI не отвечает на сообщения, нажмите "Синхронизировать" для обновления подключения.
                    </p>
                  </div>
                ) : showWhatsAppQr ? (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center py-6">
                      {wahaStatus?.status === "running" ? (
                        <div className="text-center">
                          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                          <p className="text-lg font-medium">WhatsApp подключен!</p>
                        </div>
                      ) : wahaQr?.qrCode ? (
                        <div className="space-y-4 text-center">
                          <p className="text-sm text-muted-foreground">
                            Откройте WhatsApp на телефоне → Связанные устройства → Привязка устройства
                          </p>
                          <div className="p-4 bg-white rounded-lg inline-block">
                            <QRCodeSVG 
                              value={wahaQr.qrCode} 
                              size={192}
                              level="M"
                              data-testid="img-whatsapp-qr"
                            />
                          </div>
                          <Badge className={wahaStatusColors.scan_qr}>
                            {wahaStatusLabels.scan_qr}
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-4 py-8">
                          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                          <p className="text-muted-foreground">Загрузка QR-кода...</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        type="button"
                        variant="outline" 
                        onClick={() => {
                          refetchWahaQr();
                          refetchWahaStatus();
                        }}
                        className="flex-1"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Обновить
                      </Button>
                      <Button 
                        type="button"
                        variant="ghost" 
                        onClick={() => {
                          setShowWhatsAppQr(false);
                          if (currentInstance) {
                            deleteWahaMutation.mutate(currentInstance.id);
                          }
                        }}
                        className="flex-1"
                      >
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <Phone className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">WhatsApp не подключен</p>
                          <p className="text-sm text-muted-foreground">
                            Подключите номер для получения заказов
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">Не подключен</Badge>
                    </div>
                    <Button 
                      type="button" 
                      onClick={() => {
                        if (pendingInstance) {
                          setCurrentInstance(pendingInstance);
                          setShowWhatsAppQr(true);
                        } else {
                          createWahaMutation.mutate();
                        }
                      }}
                      disabled={createWahaMutation.isPending}
                      className="w-full"
                      data-testid="button-connect-whatsapp"
                    >
                      {createWahaMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <QrCode className="mr-2 h-4 w-4" />
                      )}
                      Подключить через QR-код
                    </Button>
                  </div>
                )}
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
