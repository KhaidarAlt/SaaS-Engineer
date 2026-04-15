import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Send,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  LogIn,
  CreditCard,
  Package,
  AlertCircle,
  Zap,
  ShoppingBag,
  ArrowRight,
  MessageCircle,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

type FlowStep = "hero" | "onboarding" | "success";

interface SSEMessage {
  type: string;
  pct?: number;
  message?: string;
  productsCount?: number;
  totalPostsFound?: number;
  products?: Array<{ name: string; price: string | number; category?: string; imageUrl?: string }>;
  channelTitle?: string;
  error?: string;
}

interface ExtractedProduct {
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
}

export default function MagicImportPage() {
  const [step, setStep] = useState<FlowStep>("hero");
  const [channelUrl, setChannelUrl] = useState("");
  const [channelError, setChannelError] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sseMessages, setSseMessages] = useState<SSEMessage[]>([]);
  const [scrapingDone, setScrapingDone] = useState(false);
  const [extractedProducts, setExtractedProducts] = useState<ExtractedProduct[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"form" | "feed">("feed");

  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [notificationPhone, setNotificationPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [workingHours, setWorkingHours] = useState("");

  const [resultData, setResultData] = useState<{
    catalogUrl: string;
    slug: string;
    tenantId: string;
    trialExpiresAt: string;
  } | null>(null);
  const [totalPostsFound, setTotalPostsFound] = useState<number>(0);
  const [paidClicked, setPaidClicked] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [copied, setCopied] = useState(false);

  const feedRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const [, navigate] = useLocation();

  const cleanChannel = useCallback((input: string) => {
    return input
      .trim()
      .replace(/^@/, "")
      .replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "")
      .replace(/\/s\//g, "/")
      .replace(/\/$/, "")
      .split("/")
      .pop() || "";
  }, []);

  const validateChannel = useCallback((input: string) => {
    const clean = cleanChannel(input);
    if (!clean) return "Введите ссылку на Telegram-канал";
    if (!/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(clean)) {
      return "Некорректное имя канала. Пример: @my_channel или t.me/my_channel";
    }
    return "";
  }, [cleanChannel]);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [sseMessages]);

  const connectSSE = useCallback((sid: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    const es = new EventSource(`/api/magic-import/${sid}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: SSEMessage = JSON.parse(event.data);
        setSseMessages((prev) => [...prev, data]);

        if (data.type === "complete" && data.products) {
          setExtractedProducts(
            data.products.map((p: { name: string; price: string | number; imageUrl?: string }) => ({
              name: p.name,
              price: typeof p.price === "number" ? p.price : parseFloat(p.price) || 0,
              imageUrl: p.imageUrl,
            }))
          );
          if (data.totalPostsFound) {
            setTotalPostsFound(data.totalPostsFound);
          }
          setScrapingDone(true);
          es.close();
        }

        if (data.type === "error") {
          toast({
            title: "Ошибка импорта",
            description: data.message || "Произошла ошибка",
            variant: "destructive",
          });
          es.close();
        }
      } catch (parseError: unknown) {
        console.error("SSE parse error:", parseError);
      }
    };

    es.onerror = () => {
      es.close();
    };
  }, [toast]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const handleStart = async () => {
    const error = validateChannel(channelUrl);
    if (error) {
      setChannelError(error);
      return;
    }
    setChannelError("");
    setIsStarting(true);

    try {
      const channel = cleanChannel(channelUrl);
      const res = await apiRequest("POST", "/api/magic-import/start", {
        telegramChannel: channel,
      });
      const data = await res.json();
      setSessionId(data.sessionId);
      setSseMessages([]);
      setExtractedProducts([]);
      setTotalPostsFound(0);
      setScrapingDone(false);
      setStep("onboarding");
      connectSSE(data.sessionId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Не удалось начать импорт";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    } finally {
      setIsStarting(false);
    }
  };

  const handleComplete = async () => {
    if (!sessionId || !email || !password || !storeName) {
      toast({
        title: "Заполните обязательные поля",
        description: "Email, пароль и название магазина обязательны",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiRequest("POST", `/api/magic-import/${sessionId}/complete`, {
        email,
        password,
        storeName,
        phone: phone || undefined,
        notificationPhone: notificationPhone || undefined,
        city: city || undefined,
        address: address || undefined,
        workingHours: workingHours || undefined,
      });
      const data = await res.json();
      setResultData(data);
      setStep("success");
      await refreshUser();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ошибка создания магазина";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaidClicked = async () => {
    if (!sessionId) return;
    setIsPaying(true);
    try {
      await apiRequest("POST", `/api/magic-import/${sessionId}/paid-clicked`);
      setPaidClicked(true);
      toast({ title: "Спасибо!", description: "Мы проверим оплату и активируем магазин" });
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    } finally {
      setIsPaying(false);
    }
  };

  const handleCopy = () => {
    if (resultData) {
      navigator.clipboard.writeText(resultData.catalogUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (step === "hero") {
    return <HeroSection
      channelUrl={channelUrl}
      setChannelUrl={setChannelUrl}
      channelError={channelError}
      isStarting={isStarting}
      onStart={handleStart}
    />;
  }

  if (step === "success" && resultData) {
    return <SuccessScreen
      resultData={resultData}
      totalPostsFound={totalPostsFound}
      productsCount={extractedProducts.length}
      paidClicked={paidClicked}
      isPaying={isPaying}
      copied={copied}
      onCopy={handleCopy}
      onPaidClicked={handlePaidClicked}
      onNavigate={navigate}
      sessionId={sessionId!}
    />;
  }

  return (
    <OnboardingScreen
      sseMessages={sseMessages}
      scrapingDone={scrapingDone}
      extractedProducts={extractedProducts}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      feedRef={feedRef}
      storeName={storeName}
      setStoreName={setStoreName}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      phone={phone}
      setPhone={setPhone}
      notificationPhone={notificationPhone}
      setNotificationPhone={setNotificationPhone}
      city={city}
      setCity={setCity}
      address={address}
      setAddress={setAddress}
      workingHours={workingHours}
      setWorkingHours={setWorkingHours}
      isSubmitting={isSubmitting}
      onComplete={handleComplete}
    />
  );
}

function HeroSection({
  channelUrl,
  setChannelUrl,
  channelError,
  isStarting,
  onStart,
}: {
  channelUrl: string;
  setChannelUrl: (v: string) => void;
  channelError: string;
  isStarting: boolean;
  onStart: () => void;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2" data-testid="link-logo">
          <Bot className="h-7 w-7 text-primary" />
          <span className="font-bold text-lg">SmartCatalog</span>
        </a>
        <a href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-login">
          Войти
        </a>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl w-full text-center space-y-8"
        >
          <div className="space-y-4">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1" data-testid="badge-ai">
              <Sparkles className="h-3.5 w-3.5" />
              AI-импорт
            </Badge>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight" data-testid="heading-hero">
              Превратите ваш Telegram-канал в интернет-магазин за{" "}
              <span className="text-primary">60 секунд</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto" data-testid="text-hero-sub">
              ИИ автоматически найдёт товары, определит цены и создаст каталог.
              Просто вставьте ссылку на канал.
            </p>
          </div>

          <div className="max-w-md mx-auto space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="@channel или t.me/channel"
                value={channelUrl}
                onChange={(e) => setChannelUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onStart()}
                className="h-12 text-base"
                data-testid="input-channel"
              />
              <Button
                size="lg"
                className="h-12 px-6 gap-2"
                onClick={onStart}
                disabled={isStarting}
                data-testid="button-start"
              >
                {isStarting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Начать
              </Button>
            </div>
            {channelError && (
              <p className="text-sm text-destructive flex items-center gap-1" data-testid="text-channel-error">
                <AlertCircle className="h-3.5 w-3.5" />
                {channelError}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              <span>До 20 товаров бесплатно</span>
            </div>
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <span>ИИ-распознавание</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <span>WhatsApp интеграция</span>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

function OnboardingScreen({
  sseMessages,
  scrapingDone,
  extractedProducts,
  activeTab,
  setActiveTab,
  feedRef,
  storeName,
  setStoreName,
  email,
  setEmail,
  password,
  setPassword,
  phone,
  setPhone,
  notificationPhone,
  setNotificationPhone,
  city,
  setCity,
  address,
  setAddress,
  workingHours,
  setWorkingHours,
  isSubmitting,
  onComplete,
}: {
  sseMessages: SSEMessage[];
  scrapingDone: boolean;
  extractedProducts: ExtractedProduct[];
  activeTab: "form" | "feed";
  setActiveTab: (t: "form" | "feed") => void;
  feedRef: React.RefObject<HTMLDivElement>;
  storeName: string;
  setStoreName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  notificationPhone: string;
  setNotificationPhone: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  workingHours: string;
  setWorkingHours: (v: string) => void;
  isSubmitting: boolean;
  onComplete: () => void;
}) {
  const lastPct = sseMessages.filter((m) => m.pct !== undefined).slice(-1)[0]?.pct || 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-3 border-b flex items-center justify-between">
        <a href="/magic-import" className="flex items-center gap-2" data-testid="link-logo-onboarding">
          <Bot className="h-6 w-6 text-primary" />
          <span className="font-semibold">SmartCatalog</span>
        </a>
        <Badge variant="outline" className="gap-1">
          <Sparkles className="h-3 w-3" />
          Magic Import
        </Badge>
      </header>

      <div className="md:hidden flex border-b">
        <button
          className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${activeTab === "feed" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          onClick={() => setActiveTab("feed")}
          data-testid="tab-feed"
        >
          Прогресс {!scrapingDone && lastPct > 0 && `(${lastPct}%)`}
        </button>
        <button
          className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${activeTab === "form" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          onClick={() => setActiveTab("form")}
          data-testid="tab-form"
        >
          Данные магазина
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className={`md:w-1/2 md:border-r flex flex-col ${activeTab === "form" ? "flex" : "hidden md:flex"}`}>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <h2 className="text-lg font-semibold" data-testid="heading-form">Данные вашего магазина</h2>
            <p className="text-sm text-muted-foreground">Заполните, пока ИИ сканирует канал</p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="storeName">Название магазина *</Label>
                <Input id="storeName" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Мой магазин" data-testid="input-store-name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email (для входа) *</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" data-testid="input-email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Пароль *</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 6 символов" data-testid="input-password" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Номер телефона для отображения в магазине</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 777 123 4567" data-testid="input-phone" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notificationPhone">Номер WhatsApp для получения заявок</Label>
                <Input id="notificationPhone" value={notificationPhone} onChange={(e) => setNotificationPhone(e.target.value)} placeholder="+7 777 123 4567" data-testid="input-notification-phone" />
                <p className="text-xs text-muted-foreground">На этот номер будут приходить заказы из магазина</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="city">Город</Label>
                  <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Алматы" data-testid="input-city" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="workingHours">Часы работы</Label>
                  <Input id="workingHours" value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} placeholder="09:00-18:00" data-testid="input-hours" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">Адрес</Label>
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ул. Абая 1" data-testid="input-address" />
              </div>
            </div>

            {scrapingDone && extractedProducts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="pt-4 space-y-3"
              >
                <h3 className="text-sm font-semibold flex items-center gap-2" data-testid="heading-preview">
                  <Package className="h-4 w-4 text-primary" />
                  Вот что ИИ нашёл ({extractedProducts.length} товаров)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {extractedProducts.slice(0, 5).map((p, i) => (
                    <PreviewCard key={i} product={p} />
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          <div className="p-4 border-t bg-background">
            <Button
              className="w-full h-11 gap-2"
              onClick={onComplete}
              disabled={isSubmitting || !scrapingDone || !storeName || !email || !password}
              data-testid="button-create-store"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {scrapingDone ? "Создать магазин" : "Ожидание сканирования..."}
            </Button>
          </div>
        </div>

        <div className={`md:w-1/2 flex flex-col ${activeTab === "feed" ? "flex" : "hidden md:flex"}`}>
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              ИИ-сканирование
            </h2>
            {!scrapingDone && lastPct > 0 && (
              <Badge variant="secondary" data-testid="badge-progress">{lastPct}%</Badge>
            )}
            {scrapingDone && (
              <Badge variant="default" className="bg-green-500" data-testid="badge-done">
                <Check className="h-3 w-3 mr-1" />
                Готово
              </Badge>
            )}
          </div>

          {!scrapingDone && lastPct > 0 && (
            <div className="px-4 pt-2">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${lastPct}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}

          <div ref={feedRef} className="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-xs" data-testid="sse-feed">
            <AnimatePresence>
              {sseMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`py-1 px-2 rounded ${getMessageStyle(msg)}`}
                  data-testid={`sse-message-${i}`}
                >
                  {getMessageIcon(msg)} {msg.message || msg.type}
                </motion.div>
              ))}
            </AnimatePresence>
            {!scrapingDone && sseMessages.length > 0 && (
              <div className="flex items-center gap-2 text-muted-foreground py-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Обработка...</span>
              </div>
            )}
          </div>

          {scrapingDone && extractedProducts.length > 0 && (
            <div className="p-4 border-t space-y-2 md:hidden">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Check className="h-4 w-4 text-green-500" />
                Найдено {extractedProducts.length} товаров
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setActiveTab("form")}
                data-testid="button-go-to-form"
              >
                Заполнить данные магазина
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewCard({ product }: { product: ExtractedProduct }) {
  const formatPrice = (v: number) =>
    new Intl.NumberFormat("ru-KZ").format(v) + " ₸";

  return (
    <Card className="overflow-hidden" data-testid="card-preview-product">
      <div className="aspect-square bg-muted relative">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
      </div>
      <CardContent className="p-2">
        <p className="text-xs font-medium line-clamp-2 mb-1">{product.name}</p>
        {product.price > 0 && (
          <p className="text-xs font-bold text-primary">{formatPrice(product.price)}</p>
        )}
      </CardContent>
    </Card>
  );
}

function SuccessScreen({
  resultData,
  totalPostsFound,
  productsCount,
  paidClicked,
  isPaying,
  copied,
  onCopy,
  onPaidClicked,
  onNavigate,
  sessionId,
}: {
  resultData: { catalogUrl: string; slug: string; tenantId: string; trialExpiresAt: string };
  totalPostsFound: number;
  productsCount: number;
  paidClicked: boolean;
  isPaying: boolean;
  copied: boolean;
  onCopy: () => void;
  onPaidClicked: () => void;
  onNavigate: (path: string) => void;
  sessionId: string;
}) {
  const hasLargeChannel = totalPostsFound > 20;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-green-500/5 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-lg w-full space-y-6"
      >
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto"
          >
            <Check className="h-8 w-8 text-green-500" />
          </motion.div>
          <h1 className="text-2xl font-bold" data-testid="heading-success">Магазин создан!</h1>
          {hasLargeChannel ? (
            <div className="space-y-1">
              <p className="text-muted-foreground">
                Сканер нашёл <span className="font-semibold text-foreground">{totalPostsFound}+ позиций</span> в вашем канале.
              </p>
              <p className="text-muted-foreground text-sm">
                Магазин запущен с 20 лучшими — остальные добавятся автоматически после активации.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Создан магазин из {productsCount || 20} товаров.
            </p>
          )}
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Ссылка на каталог</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={resultData.catalogUrl}
                  readOnly
                  className="font-mono text-sm"
                  data-testid="input-catalog-url"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={onCopy}
                  data-testid="button-copy-url"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => window.open(resultData.catalogUrl, "_blank")}
                data-testid="button-open-store"
              >
                <ExternalLink className="h-4 w-4" />
                Открыть магазин
              </Button>
              <Button
                className="gap-2"
                onClick={() => onNavigate("/dashboard")}
                data-testid="button-go-dashboard"
              >
                <LogIn className="h-4 w-4" />
                Кабинет
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="text-center">
              <p className="text-sm font-medium">Активировать полную версию</p>
              <p className="text-xs text-muted-foreground mt-1">
                Все товары из канала, AI-ассистент, WhatsApp-бот
              </p>
            </div>
            {paidClicked ? (
              <div className="text-center py-3 bg-green-50 dark:bg-green-500/10 rounded-lg" data-testid="text-paid-confirmed">
                <Check className="h-5 w-5 text-green-500 mx-auto mb-1" />
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  Запрос отправлен! Мы проверим оплату и активируем магазин.
                </p>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                onClick={onPaidClicked}
                disabled={isPaying}
                data-testid="button-paid"
              >
                {isPaying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                Я оплатил
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function getMessageStyle(msg: SSEMessage): string {
  switch (msg.type) {
    case "connected":
      return "text-muted-foreground bg-muted/50";
    case "progress":
      return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10";
    case "complete":
      return "text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-500/20 font-semibold";
    case "error":
      return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10";
    default:
      return "text-muted-foreground";
  }
}

function getMessageIcon(msg: SSEMessage): string {
  switch (msg.type) {
    case "connected":
      return "🔗";
    case "progress":
      return "📡";
    case "complete":
      return "🎉";
    case "error":
      return "❌";
    default:
      return "•";
  }
}
