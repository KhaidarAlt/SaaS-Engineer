import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useScroll, useTransform, useInView, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { Link } from "wouter";
import {
  MessageSquare,
  ShoppingCart,
  Bot,
  BarChart3,
  TrendingUp,
  Check,
  X,
  Zap,
  Clock,
  Users,
  Package,
  Layers,
  Sparkles,
  Globe,
  ArrowRight,
  Star,
  Eye,
  Phone,
  CreditCard,
  Send,
  Shield,
  Instagram,
  Smartphone,
  Palette,
  ChefHat,
  Shirt,
  Store,
  Target,
  Brain,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  Play,
  Workflow,
  Receipt,
  Bell,
  Link2,
  ChevronDown,
  Crown,
  Rocket,
  Calculator,
} from "lucide-react";
import { SiWhatsapp, SiTelegram, SiInstagram } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

const fadeInUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
};

const staggerContainer = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.08 } },
  viewport: { once: true },
};

const staggerItem = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
};

function AnimatedCounter({ target, suffix = "", duration = 2000 }: { target: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, target, duration]);

  return <span ref={ref}>{count.toLocaleString("ru-RU")}{suffix}</span>;
}

function TypingText({ texts, className }: { texts: string[]; className?: string }) {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentFullText = texts[currentTextIndex];
    let timeout: NodeJS.Timeout;

    if (!isDeleting && displayedText.length < currentFullText.length) {
      timeout = setTimeout(() => {
        setDisplayedText(currentFullText.slice(0, displayedText.length + 1));
      }, 60);
    } else if (!isDeleting && displayedText.length === currentFullText.length) {
      timeout = setTimeout(() => setIsDeleting(true), 2000);
    } else if (isDeleting && displayedText.length > 0) {
      timeout = setTimeout(() => {
        setDisplayedText(displayedText.slice(0, -1));
      }, 30);
    } else if (isDeleting && displayedText.length === 0) {
      setIsDeleting(false);
      setCurrentTextIndex((prev) => (prev + 1) % texts.length);
    }

    return () => clearTimeout(timeout);
  }, [displayedText, isDeleting, currentTextIndex, texts]);

  return (
    <span className={className}>
      {displayedText}
      <span className="animate-pulse text-primary">|</span>
    </span>
  );
}

function FloatingBubble({ delay, x, y, children }: { delay: number; x: number; y: number; children: React.ReactNode }) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%` }}
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: [0, 0.7, 0.7, 0], scale: [0.8, 1, 1, 0.9], y: [20, 0, 0, -10] }}
      transition={{ delay, duration: 4, repeat: Infinity, repeatDelay: 3 }}
    >
      {children}
    </motion.div>
  );
}

function KaspiFlowStep({ step, icon: Icon, title, desc, delay }: { step: number; icon: any; title: string; desc: string; delay: number }) {
  return (
    <motion.div
      className="flex flex-col items-center text-center relative"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="w-14 h-14 rounded-2xl bg-[#F14635]/10 dark:bg-[#F14635]/20 flex items-center justify-center mb-3 relative">
        <Icon className="w-6 h-6 text-[#F14635]" />
        <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#F14635] text-white text-xs font-bold flex items-center justify-center">
          {step}
        </span>
      </div>
      <h4 className="font-semibold text-sm mb-1">{title}</h4>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </motion.div>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const { scrollYProgress } = useScroll();
  const headerBg = useTransform(scrollYProgress, [0, 0.05], [0, 1]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-[999] bg-background/80 backdrop-blur-xl border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold" data-testid="text-brand-name">SmartCatalog</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <ThemeToggle />
            {user ? (
              <Link href="/dashboard">
                <Button data-testid="button-dashboard">Личный кабинет</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" data-testid="link-login">Войти</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" data-testid="button-register-header">Создать каталог</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* HERO SECTION */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="pt-28 pb-16 md:pt-36 md:pb-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-primary/4 dark:from-primary/15 dark:via-transparent dark:to-primary/8" />
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
        </div>

        <FloatingBubble delay={0.5} x={8} y={25}>
          <div className="bg-[#25D366] text-white px-3 py-1.5 rounded-xl rounded-bl-none text-xs shadow-lg max-w-[160px]">
            Здравствуйте! Есть в наличии?
          </div>
        </FloatingBubble>
        <FloatingBubble delay={2} x={78} y={18}>
          <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded-xl rounded-br-none text-xs shadow-lg max-w-[180px]">
            Да! Отправляю ссылку на оплату
          </div>
        </FloatingBubble>
        <FloatingBubble delay={3.5} x={85} y={60}>
          <div className="bg-[#F14635] text-white px-3 py-1.5 rounded-xl text-xs shadow-lg">
            Kaspi: Оплачено 12 500 ₸
          </div>
        </FloatingBubble>

        <div className="container mx-auto px-4 relative">
          <motion.div
            className="max-w-4xl mx-auto text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm no-default-hover-elevate no-default-active-elevate">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                AI-powered платформа
              </Badge>
            </motion.div>

            <h1 className="text-[32px] sm:text-[40px] md:text-[52px] lg:text-[62px] font-bold tracking-tight mb-4 leading-[1.1]" data-testid="text-hero-title">
              Преврати <span className="text-primary">WhatsApp</span> в{" "}
              <br className="hidden sm:block" />
              интернет-магазин
            </h1>
            <h2 className="text-[20px] sm:text-[24px] md:text-[30px] font-semibold tracking-tight mb-4 leading-[1.2] text-foreground/80">
              с <TypingText texts={["ИИ-продавцом", "CRM-системой", "оплатой Kaspi", "аналитикой"]} className="text-primary" /> — за 5 минут
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              Клиент платит в привычном приложении Kaspi.
              ИИ общается, выставляет счёт, проверяет оплату
              и закрывает сделку в CRM.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center mb-4">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto rounded-xl" data-testid="button-hero-cta">
                  Создать каталог бесплатно
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <div className="flex flex-col items-center">
                <Link href="/c/demo">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-xl" data-testid="button-hero-demo">
                    <Eye className="w-4 h-4 mr-2" />
                    Посмотреть пример магазина
                  </Button>
                </Link>
                <p className="text-xs text-muted-foreground mt-2 max-w-[280px] text-center">
                  Оформите тестовый заказ и получите его в WhatsApp
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Без карты. Сможет каждый. Бесплатно до 20 товаров навсегда.
            </p>
          </motion.div>

          {/* Stats counters */}
          <motion.div
            className="flex flex-wrap justify-center gap-6 sm:gap-10 mt-12 md:mt-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            {[
              { value: 500, suffix: "+", label: "Бизнесов", tid: "stat-businesses" },
              { value: 50000, suffix: "+", label: "Товаров в каталогах", tid: "stat-products" },
              { value: 12000, suffix: "+", label: "Заказов обработано", tid: "stat-orders" },
            ].map((stat, i) => (
              <div key={i} className="text-center" data-testid={stat.tid}>
                <div className="text-2xl sm:text-3xl font-bold text-foreground">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* PROBLEMS SECTION */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="text-center mb-12 md:mb-16">
            <Badge variant="secondary" className="mb-4 no-default-hover-elevate no-default-active-elevate">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Знакомая ситуация?
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4" data-testid="text-problems-title">
              Почему бизнес теряет заказы в WhatsApp
            </h2>
          </motion.div>

          <motion.div
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-5xl mx-auto"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {[
              { icon: MessageSquare, text: "Клиенты теряются в переписках", desc: "Сообщения тонут среди десятков чатов" },
              { icon: Package, text: "Нет единого каталога", desc: "Фото товаров разбросаны по галерее" },
              { icon: ShoppingCart, text: "Заказы хаотично", desc: "Нет системы учёта и контроля" },
              { icon: Clock, text: "Менеджеры не успевают", desc: "Ответ через час — клиент уже ушёл" },
              { icon: BarChart3, text: "Нет аналитики", desc: "Не знаете, что продаётся лучше" },
              { icon: Layers, text: "Только чаты", desc: "Без CRM, без воронки, без системы" },
            ].map((item, i) => (
              <motion.div key={i} variants={staggerItem}>
                <Card className="h-full hover-elevate">
                  <CardContent className="pt-6 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-destructive/10 dark:bg-destructive/20 flex items-center justify-center shrink-0">
                      <item.icon className="w-5 h-5 text-destructive" />
                    </div>
                    <div>
                      <p className="font-semibold mb-0.5">{item.text}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <motion.div {...fadeInUp} className="text-center mt-10 md:mt-14">
            <div className="inline-flex items-center gap-2 bg-destructive/10 dark:bg-destructive/20 text-destructive px-5 py-2.5 rounded-md">
              <Target className="w-5 h-5 shrink-0" />
              <span className="font-semibold text-sm sm:text-base">Проблема — в отсутствии системы продаж</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* KASPI WITHOUT ACQUIRING */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="text-center mb-12 md:mb-16">
            <Badge variant="secondary" className="mb-4 no-default-hover-elevate no-default-active-elevate bg-[#F14635]/10 dark:bg-[#F14635]/20 text-[#F14635] border-[#F14635]/20">
              <CreditCard className="w-3 h-3 mr-1" />
              Kaspi Business
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4" data-testid="text-kaspi-title">
              Оплата через Kaspi — без эквайринга
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              ИИ автоматически формирует ссылку Kaspi, клиент оплачивает в приложении, а статус обновляется в CRM
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
              <KaspiFlowStep step={1} icon={Bot} title="ИИ формирует счёт" desc="Автоматически создаёт ссылку на оплату" delay={0} />
              <KaspiFlowStep step={2} icon={Send} title="Отправка клиенту" desc="Ссылка уходит прямо в WhatsApp" delay={0.1} />
              <KaspiFlowStep step={3} icon={Smartphone} title="Оплата в Kaspi" desc="Клиент платит в привычном приложении" delay={0.2} />
              <KaspiFlowStep step={4} icon={CheckCircle2} title="Статус: Оплачен" desc="CRM обновляется автоматически" delay={0.3} />
              <KaspiFlowStep step={5} icon={Bell} title="Уведомление" desc="Менеджер получает уведомление" delay={0.4} />
            </div>

            <motion.div
              {...fadeInUp}
              className="mt-8 md:mt-12 text-center"
            >
              <Card className="inline-flex flex-col sm:flex-row items-center gap-4 p-5 md:p-6 bg-gradient-to-r from-[#F14635]/5 to-primary/5 dark:from-[#F14635]/10 dark:to-primary/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F14635]/10 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 text-[#F14635]" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-sm">0% комиссии за эквайринг</p>
                    <p className="text-xs text-muted-foreground">Только стандартная комиссия Kaspi Business</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* CONNECTION SPEED / CHANNELS */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="text-center mb-12 md:mb-16">
            <Badge variant="secondary" className="mb-4 no-default-hover-elevate no-default-active-elevate">
              <Zap className="w-3 h-3 mr-1" />
              Мультиканальность
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4" data-testid="text-channels-title">
              Подключение за минуты — продажи во всех каналах
            </h2>
          </motion.div>

          <motion.div
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 max-w-5xl mx-auto"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {[
              { icon: SiWhatsapp, title: "WhatsApp AI", desc: "ИИ отвечает за 30 секунд", time: "30 сек", color: "text-[#25D366]", bgColor: "bg-[#25D366]/10 dark:bg-[#25D366]/20" },
              { icon: SiWhatsapp, title: "Cloud API", desc: "Официальное API Meta", time: "5 мин", color: "text-[#25D366]", bgColor: "bg-[#25D366]/10 dark:bg-[#25D366]/20" },
              { icon: SiInstagram, title: "Instagram Direct", desc: "Автоответы в директ", time: "5 мин", color: "text-[#E4405F]", bgColor: "bg-[#E4405F]/10 dark:bg-[#E4405F]/20" },
              { icon: SiTelegram, title: "Telegram", desc: "Бот для заказов", time: "Скоро", color: "text-[#26A5E4]", bgColor: "bg-[#26A5E4]/10 dark:bg-[#26A5E4]/20" },
            ].map((ch, i) => (
              <motion.div key={i} variants={staggerItem}>
                <Card className="h-full hover-elevate">
                  <CardContent className="pt-6 text-center">
                    <div className={`w-12 h-12 rounded-xl ${ch.bgColor} flex items-center justify-center mx-auto mb-3`}>
                      <ch.icon className={`w-6 h-6 ${ch.color}`} />
                    </div>
                    <h3 className="font-semibold mb-1">{ch.title}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{ch.desc}</p>
                    <Badge variant="secondary" className="text-xs no-default-hover-elevate no-default-active-elevate">
                      <Clock className="w-3 h-3 mr-1" />
                      {ch.time}
                    </Badge>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            className="flex flex-wrap justify-center gap-3 mt-8 md:mt-10"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {[
              { icon: Globe, label: "Свой домен" },
              { icon: Link2, label: "BIO для Instagram" },
              { icon: Smartphone, label: "Виджет на сайт" },
            ].map((extra, i) => (
              <motion.div key={i} variants={staggerItem}>
                <div className="flex items-center gap-2 bg-background border rounded-md px-4 py-2.5 text-sm">
                  <extra.icon className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-medium">{extra.label}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MULTI-CATALOG TEMPLATES */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="text-center mb-12 md:mb-16">
            <Badge variant="secondary" className="mb-4 no-default-hover-elevate no-default-active-elevate">
              <Palette className="w-3 h-3 mr-1" />
              3 шаблона каталога
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4" data-testid="text-templates-title">
              Каталог, который подходит вашей нише
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Не просто список товаров — а полноценный шоппинг-опыт, адаптированный под вашу индустрию
            </p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-3 gap-5 md:gap-6 max-w-5xl mx-auto"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {/* Universal */}
            <motion.div variants={staggerItem}>
              <Card className="h-full hover-elevate overflow-visible">
                <CardContent className="pt-6">
                  <div className="w-full h-36 sm:h-44 rounded-md bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 flex items-center justify-center mb-4 relative overflow-hidden">
                    <div className="grid grid-cols-3 gap-1.5 p-3 w-full max-w-[200px]">
                      {[1,2,3,4,5,6].map((n) => (
                        <div key={n} className="aspect-square rounded-md bg-primary/15 dark:bg-primary/25 flex items-center justify-center">
                          <Package className="w-4 h-4 text-primary/50" />
                        </div>
                      ))}
                    </div>
                    <Badge className="absolute top-2 right-2 text-[10px] no-default-hover-elevate no-default-active-elevate" variant="secondary">
                      <Store className="w-3 h-3 mr-1" />
                      E-commerce
                    </Badge>
                  </div>
                  <h3 className="text-lg font-bold mb-1" data-testid="text-template-universal">Universal</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Классический интернет-магазин с сеткой, списком и таблицей. Техника, мебель, электроника.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Сетка", "Список", "Таблица", "Фильтры"].map((f) => (
                      <Badge key={f} variant="outline" className="text-[10px] no-default-hover-elevate no-default-active-elevate">{f}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Fashion */}
            <motion.div variants={staggerItem}>
              <Card className="h-full hover-elevate overflow-visible">
                <CardContent className="pt-6">
                  <div className="w-full h-36 sm:h-44 rounded-md bg-gradient-to-br from-[#E4405F]/10 to-[#E4405F]/5 dark:from-[#E4405F]/20 dark:to-[#E4405F]/10 flex items-center justify-center mb-4 relative overflow-hidden">
                    <div className="flex flex-col gap-1 w-24">
                      {[1,2,3].map((n) => (
                        <div key={n} className="w-full h-10 rounded-md bg-[#E4405F]/15 dark:bg-[#E4405F]/25 flex items-center justify-center">
                          <Shirt className="w-4 h-4 text-[#E4405F]/50" />
                        </div>
                      ))}
                    </div>
                    <Badge className="absolute top-2 right-2 text-[10px] no-default-hover-elevate no-default-active-elevate bg-[#E4405F]/10 text-[#E4405F] border-[#E4405F]/20">
                      <SiInstagram className="w-3 h-3 mr-1" />
                      Reels
                    </Badge>
                  </div>
                  <h3 className="text-lg font-bold mb-1" data-testid="text-template-fashion">Fashion</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Вертикальная лента как Instagram Reels. Одежда, обувь, аксессуары.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Свайп", "Размеры", "Цвета", "ИИ-стилист"].map((f) => (
                      <Badge key={f} variant="outline" className="text-[10px] no-default-hover-elevate no-default-active-elevate">{f}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Food */}
            <motion.div variants={staggerItem}>
              <Card className="h-full hover-elevate overflow-visible">
                <CardContent className="pt-6">
                  <div className="w-full h-36 sm:h-44 rounded-md bg-gradient-to-br from-amber-500/10 to-amber-500/5 dark:from-amber-500/20 dark:to-amber-500/10 flex items-center justify-center mb-4 relative overflow-hidden">
                    <div className="space-y-1.5 w-full max-w-[200px] px-3">
                      {[1,2,3].map((n) => (
                        <div key={n} className="flex items-center gap-2 bg-amber-500/10 dark:bg-amber-500/20 rounded-md p-1.5">
                          <div className="w-8 h-8 rounded-md bg-amber-500/20 dark:bg-amber-500/30 flex items-center justify-center shrink-0">
                            <ChefHat className="w-4 h-4 text-amber-600/50 dark:text-amber-400/50" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="h-2 bg-amber-500/20 dark:bg-amber-500/30 rounded-md w-3/4" />
                            <div className="h-1.5 bg-amber-500/10 dark:bg-amber-500/20 rounded-md w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <Badge className="absolute top-2 right-2 text-[10px] no-default-hover-elevate no-default-active-elevate bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                      <ChefHat className="w-3 h-3 mr-1" />
                      Delivery
                    </Badge>
                  </div>
                  <h3 className="text-lg font-bold mb-1" data-testid="text-template-food">Food</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Меню как в Wolt и Яндекс Еде. Рестораны, кафе, доставка еды.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Категории", "Модификаторы", "Корзина", "ИИ-официант"].map((f) => (
                      <Badge key={f} variant="outline" className="text-[10px] no-default-hover-elevate no-default-active-elevate">{f}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* CASES BLOCK */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="text-center mb-12 md:mb-16">
            <Badge variant="secondary" className="mb-4 no-default-hover-elevate no-default-active-elevate">
              <TrendingUp className="w-3 h-3 mr-1" />
              Результаты
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4" data-testid="text-cases-title">
              Кейсы наших клиентов
            </h2>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-3 gap-5 md:gap-6 max-w-5xl mx-auto"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {[
              {
                name: "ESSEN Техника",
                niche: "Бытовая техника",
                template: "Universal",
                icon: Store,
                color: "text-primary",
                bgColor: "bg-primary/10 dark:bg-primary/20",
                before: ["Ручные ответы в WhatsApp", "Потери клиентов до 40%", "Нет учёта заказов"],
                after: ["+27% оплаченных заказов", "CRM + автоматизация", "Kaspi-оплата без эквайринга"],
                metric: "+27%",
                metricLabel: "оплат",
              },
              {
                name: "LUNA Fashion",
                niche: "Женская одежда",
                template: "Fashion",
                icon: Shirt,
                color: "text-[#E4405F]",
                bgColor: "bg-[#E4405F]/10 dark:bg-[#E4405F]/20",
                before: ["Вопросы о размерах, хаос", "Долгие ответы менеджеров", "Нет систематизации"],
                after: ["+35% заказов через каталог", "ИИ-стилист отвечает 24/7", "Автоподбор размеров"],
                metric: "+35%",
                metricLabel: "заказов",
              },
              {
                name: "Tokyo Pizza",
                niche: "Доставка еды (Instagram)",
                template: "Food",
                icon: ChefHat,
                color: "text-amber-600 dark:text-amber-400",
                bgColor: "bg-amber-500/10 dark:bg-amber-500/20",
                before: ["Заказ занимал 7 минут", "Менеджер вручную записывал", "Ошибки в заказах"],
                after: ["Скорость заказа 3 минуты", "+40% повторных заказов", "Автоматический приём"],
                metric: "+40%",
                metricLabel: "повторных",
              },
            ].map((caseItem, i) => (
              <motion.div key={i} variants={staggerItem}>
                <Card className="h-full flex flex-col" data-testid={`card-case-${i}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-xl ${caseItem.bgColor} flex items-center justify-center`}>
                        <caseItem.icon className={`w-5 h-5 ${caseItem.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-base" data-testid={`text-case-name-${i}`}>{caseItem.name}</CardTitle>
                        <CardDescription className="text-xs">{caseItem.niche}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="self-start text-[10px] no-default-hover-elevate no-default-active-elevate">
                      {caseItem.template}
                    </Badge>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-destructive uppercase tracking-wide mb-2">До</p>
                      <ul className="space-y-1.5">
                        {caseItem.before.map((b, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <X className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">После</p>
                      <ul className="space-y-1.5">
                        {caseItem.after.map((a, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm">
                            <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-3 border-t">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-primary">{caseItem.metric}</span>
                      <span className="text-sm text-muted-foreground">{caseItem.metricLabel}</span>
                    </div>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* AI ASSISTANT */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 md:gap-12 items-center">
            <motion.div {...fadeInUp} className="order-2 lg:order-1">
              <Card className="p-5 md:p-6 bg-gradient-to-br from-primary/5 to-primary/2 dark:from-primary/10 dark:to-primary/5">
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-2">
                      <p className="text-sm">Здравствуйте! Какие размеры есть у кроссовок Nike Air Max?</p>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-none px-4 py-2 max-w-[85%]">
                      <p className="text-sm">Добрый день! Nike Air Max доступны в размерах 39-45. Стоимость 45 900 ₸. Сейчас скидка 15%! Оформить заказ?</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-primary-foreground" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-2">
                      <p className="text-sm">Да, 42 размер. Как оплатить?</p>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-none px-4 py-2 max-w-[85%]">
                      <p className="text-sm">Отлично! Вот ссылка для оплаты через Kaspi: kaspi.kz/pay/... Оплата безопасна. После оплаты отправлю трек-номер!</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-primary-foreground" />
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div {...fadeInUp} className="order-1 lg:order-2">
              <Badge variant="secondary" className="mb-4 no-default-hover-elevate no-default-active-elevate">
                <Bot className="w-3 h-3 mr-1" />
                AI-ассистент
              </Badge>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4" data-testid="text-ai-title">
                ИИ-продавец, который закрывает сделки
              </h2>
              <p className="text-muted-foreground mb-6">
                Не просто чат-бот — полноценный AI-продавец, который знает ваш каталог, акции и скрипты продаж.
              </p>
              <div className="space-y-3">
                {[
                  { icon: Clock, text: "Продаёт 24/7 без выходных" },
                  { icon: Sparkles, text: "Знает акции, цены и наличие" },
                  { icon: BookOpen, text: "Следует готовым скриптам продаж" },
                  { icon: Brain, text: "Тестирование и коррекция диалогов" },
                  { icon: ShoppingCart, text: "Дожимает брошенные корзины" },
                  { icon: Users, text: "Передаёт менеджеру при необходимости" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
                      <item.icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm sm:text-base">{item.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* CRM SECTION */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 md:gap-12 items-center">
            <motion.div {...fadeInUp}>
              <Badge variant="secondary" className="mb-4 no-default-hover-elevate no-default-active-elevate">
                <Workflow className="w-3 h-3 mr-1" />
                CRM
              </Badge>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4" data-testid="text-crm-title">
                Встроенная CRM — ничего не теряется
              </h2>
              <p className="text-muted-foreground mb-6">
                Каждый заказ автоматически попадает в CRM. Статусы, история, аналитика — всё в одном месте.
              </p>
              <div className="space-y-3">
                {[
                  "Заказ автоматически приходит менеджеру",
                  "Статусы: новый, в работе, оплачен, выполнен",
                  "Полная история переписки с клиентом",
                  "Интеграция с Bitrix24 и amoCRM",
                ].map((text, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm sm:text-base">{text}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div {...fadeInUp}>
              <Card className="p-5 md:p-6">
                <div className="space-y-3">
                  {[
                    { status: "Новый", color: "bg-blue-500", name: "Заказ #1284", time: "1 мин назад", amount: "45 900 ₸" },
                    { status: "Оплачен", color: "bg-green-500", name: "Заказ #1283", time: "12 мин назад", amount: "23 500 ₸" },
                    { status: "В работе", color: "bg-amber-500", name: "Заказ #1282", time: "25 мин назад", amount: "67 200 ₸" },
                    { status: "Выполнен", color: "bg-muted-foreground", name: "Заказ #1281", time: "1 час назад", amount: "12 800 ₸" },
                  ].map((order, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${order.color}`} />
                        <span className="font-medium text-sm truncate">{order.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-medium">{order.amount}</span>
                        <Badge variant="outline" className="text-[10px] no-default-hover-elevate no-default-active-elevate">{order.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* PRICING — 3 TIERS + PSYCHOLOGICAL TRIGGERS */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="text-center mb-10 md:mb-14">
            <Badge variant="secondary" className="mb-4 no-default-hover-elevate no-default-active-elevate">
              <Receipt className="w-3 h-3 mr-1" />
              Тарифы
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3" data-testid="text-pricing-title">
              Тарифы SmartCatalog
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-2">
              AI-продавец, который увеличивает продажи в WhatsApp, Instagram и Telegram
            </p>
            <p className="text-sm text-muted-foreground/80 max-w-lg mx-auto">
              Большинство клиентов получают первые заявки уже в первые недели
            </p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-3 gap-5 md:gap-6 max-w-5xl mx-auto items-stretch"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {/* ─── Start ─── */}
            <motion.div variants={staggerItem} className="flex">
              <Card className="h-full flex flex-col w-full relative overflow-visible" data-testid="card-plan-start">
                <div className="absolute -top-3 left-4">
                  <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-[10px] px-2.5 py-0.5">
                    Ранняя цена для первых 50 клиентов
                  </Badge>
                </div>
                <CardHeader className="pt-8 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-blue-500" />
                    </div>
                    <CardTitle className="text-xl">Start</CardTitle>
                  </div>
                  <CardDescription className="text-sm">Запустите AI-продажи и получите первые заказы</CardDescription>
                  <div className="pt-3">
                    <span className="text-base text-muted-foreground line-through" data-testid="text-price-start-old">9 990 ₸</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold" data-testid="text-price-start">4 990 ₸</span>
                      <span className="text-muted-foreground text-sm">/ мес</span>
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                      Экономия более 60 000 ₸ в год
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Цена фиксируется навсегда
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pt-0">
                  <ul className="space-y-2.5 text-sm">
                    {[
                      "SmartCatalog",
                      "Ваш AI-продавец (все функции)",
                      "Раздел Рост",
                      "1 канал подключения",
                      "100 диалогов в месяц",
                    ].map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 pt-3 border-t border-border/50 space-y-1.5">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Попробуйте бесплатно 2 дня
                    </p>
                    <p className="text-xs text-muted-foreground">50 ₸ за диалог сверх лимита</p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Link href="/register" className="w-full">
                    <Button variant="outline" className="w-full" data-testid="button-pricing-start">
                      Начать бесплатно
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            </motion.div>

            {/* ─── Business (highlighted) ─── */}
            <motion.div variants={staggerItem} className="flex">
              <Card className="h-full flex flex-col w-full border-primary relative overflow-visible" data-testid="card-plan-business">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="no-default-hover-elevate no-default-active-elevate px-4 py-1 text-xs">
                    <Crown className="w-3 h-3 mr-1" />
                    Самый популярный
                  </Badge>
                </div>
                <CardHeader className="pt-8 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Crown className="w-5 h-5 text-amber-500" />
                    </div>
                    <CardTitle className="text-xl">Business</CardTitle>
                  </div>
                  <CardDescription className="text-sm">Полноценная система AI-продаж для роста бизнеса</CardDescription>
                  <div className="pt-3">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold" data-testid="text-price-business">19 990 ₸</span>
                      <span className="text-muted-foreground text-sm">/ мес</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pt-0">
                  <ul className="space-y-2.5 text-sm">
                    {[
                      "Все функции платформы",
                      "AI-продавец",
                      "Growth Engine",
                      "Мультиканал (WhatsApp, Instagram, Telegram)",
                      "Аналитика",
                      "300 диалогов в месяц",
                    ].map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 pt-3 border-t border-border/50 space-y-1.5">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Попробуйте бесплатно 2 дня
                    </p>
                    <p className="text-xs text-muted-foreground">50 ₸ за диалог сверх лимита</p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Link href="/register" className="w-full">
                    <Button className="w-full" data-testid="button-pricing-business">
                      Запустить рост
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            </motion.div>

            {/* ─── Scale ─── */}
            <motion.div variants={staggerItem} className="flex">
              <Card className="h-full flex flex-col w-full" data-testid="card-plan-scale">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <Rocket className="w-5 h-5 text-purple-500" />
                    </div>
                    <CardTitle className="text-xl">Scale</CardTitle>
                  </div>
                  <CardDescription className="text-sm">Для компаний, которые масштабируют продажи</CardDescription>
                  <div className="pt-3">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold" data-testid="text-price-scale">29 990 ₸</span>
                      <span className="text-muted-foreground text-sm">/ мес</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pt-0">
                  <ul className="space-y-2.5 text-sm">
                    {[
                      "Все функции",
                      "Growth автоматизации",
                      "Расширенная аналитика",
                      "Приоритетная поддержка",
                      "700 диалогов в месяц",
                    ].map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 pt-3 border-t border-border/50 space-y-1.5">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Попробуйте бесплатно 2 дня
                    </p>
                    <p className="text-xs text-muted-foreground">50 ₸ за диалог сверх лимита</p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Link href="/register" className="w-full">
                    <Button variant="outline" className="w-full" data-testid="button-pricing-scale">
                      Масштабировать
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            </motion.div>
          </motion.div>

          {/* Social proof + risk reversal */}
          <motion.div {...fadeInUp} className="text-center mt-8 space-y-2">
            <p className="text-sm font-medium">
              Даже один возвращённый клиент окупает тариф
            </p>
            <p className="text-xs text-muted-foreground">
              Уже используют магазины техники, одежды и доставки
            </p>
          </motion.div>

          {/* ROI calculator block */}
          <motion.div {...fadeInUp} className="mt-12 max-w-2xl mx-auto">
            <Card data-testid="card-roi-block">
              <CardContent className="p-6 md:p-8 text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <Calculator className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Сколько вы теряете сейчас?</h3>
                <p className="text-muted-foreground">
                  500 клиентов в базе <ArrowRight className="inline w-4 h-4 mx-1" /> 5% возврата <ArrowRight className="inline w-4 h-4 mx-1" /> <span className="font-semibold text-foreground">+1 250 000 ₸ выручки</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  SmartCatalog помогает вернуть клиентов и увеличить средний чек
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* FAQ */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="py-16 md:py-24 bg-muted/30" data-testid="section-faq">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="text-center mb-10">
            <Badge variant="secondary" className="mb-4 no-default-hover-elevate no-default-active-elevate">
              <BookOpen className="w-3 h-3 mr-1" />
              Вопросы
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3">
              Частые вопросы
            </h2>
          </motion.div>

          <motion.div {...fadeInUp} className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="q1" data-testid="faq-item-1">
                <AccordionTrigger className="text-left text-sm md:text-base">Что такое SmartCatalog?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  SmartCatalog — это платформа для бизнеса, которая создаёт онлайн-каталог и подключает AI-продавца к WhatsApp, Instagram и Telegram. AI отвечает клиентам 24/7, помогает с выбором товара и ведёт до покупки.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q2" data-testid="faq-item-2">
                <AccordionTrigger className="text-left text-sm md:text-base">Что входит в «диалог»?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Диалог — это общение AI-ассистента с одним уникальным клиентом (номер телефона) в течение месяца. Все сообщения с одним клиентом в рамках месяца считаются одним диалогом, сколько бы их ни было.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q3" data-testid="faq-item-3">
                <AccordionTrigger className="text-left text-sm md:text-base">Что происходит, если я превышу лимит диалогов?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  AI продолжает работать без остановки. Каждый диалог сверх лимита тарифа стоит 50 ₸. Вы платите только за реально использованные диалоги, никаких скрытых платежей.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q4" data-testid="faq-item-4">
                <AccordionTrigger className="text-left text-sm md:text-base">Есть ли бесплатный период?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Да, при регистрации на любом тарифе вы получаете 2 дня бесплатного использования. Это позволяет настроить каталог, подключить AI-ассистента и протестировать его работу до оплаты.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q5" data-testid="faq-item-5">
                <AccordionTrigger className="text-left text-sm md:text-base">Как подключить WhatsApp / Instagram / Telegram?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Подключение занимает несколько минут прямо из панели управления. Для WhatsApp — через QR-код или Meta Business API. Для Instagram и Telegram — через привязку аккаунта. На тарифе Start доступен один канал, на Business и Scale — все каналы.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q6" data-testid="faq-item-6">
                <AccordionTrigger className="text-left text-sm md:text-base">Чем отличается тариф Business от Start?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Business включает все каналы одновременно (WhatsApp + Instagram + Telegram), 300 диалогов вместо 100, Growth Engine для рассылок и возврата клиентов, а также развёрнутую аналитику по продажам.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q7" data-testid="faq-item-7">
                <AccordionTrigger className="text-left text-sm md:text-base">Можно ли перейти на другой тариф?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Да, вы можете повысить или понизить тариф в любое время из личного кабинета. Переход на более высокий тариф активируется сразу, на более низкий — с нового расчётного периода.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q8" data-testid="faq-item-8">
                <AccordionTrigger className="text-left text-sm md:text-base">Как AI знает мои товары и цены?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  AI автоматически изучает ваш каталог — названия, описания, цены, акции и характеристики. Вы также можете добавить базу знаний с ответами на частые вопросы, правилами доставки и другой информацией о вашем бизнесе.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q9" data-testid="faq-item-9">
                <AccordionTrigger className="text-left text-sm md:text-base">Безопасны ли мои данные?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Данные каждого бизнеса полностью изолированы. Мы используем шифрование при передаче и хранении, регулярные бэкапы и современные стандарты безопасности. Никто, кроме вас, не имеет доступа к вашим данным.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q10" data-testid="faq-item-10">
                <AccordionTrigger className="text-left text-sm md:text-base">Могу ли я использовать свой домен?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Да, вы можете подключить свой домен к каталогу для повышения узнаваемости бренда. Также доступны бесплатные поддомены вида yourshop.botfactory.kz.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* FINAL CTA */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-primary/8 via-primary/4 to-transparent dark:from-primary/15 dark:via-primary/8 dark:to-transparent relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-10 right-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-20 w-80 h-80 bg-primary/3 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 relative">
          <motion.div {...fadeInUp} className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4" data-testid="text-cta-title">
              Создайте свой интернет-магазин в WhatsApp уже сегодня
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Присоединяйтесь к 500+ бизнесам, которые уже продают через SmartCatalog
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-4">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto rounded-xl" data-testid="button-final-cta">
                  Создать каталог бесплатно
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/c/demo">
                <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-xl" data-testid="button-final-demo">
                  Посмотреть демо
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              Своими силами. Без карты. С результатом.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* FOOTER */}
      {/* ═══════════════════════════════════════════════════════ */}
      <footer className="py-10 md:py-12 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">SmartCatalog</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground text-center">
                AI-интернет-магазин в WhatsApp для вашего бизнеса
              </p>
              <a
                href="tel:+77773875355"
                className="flex items-center gap-2 text-foreground font-medium hover:text-primary transition-colors"
                data-testid="link-phone-footer"
              >
                <Phone className="w-4 h-4" />
                +7 777 387 53 55
              </a>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-sm text-muted-foreground">
              <Link href="/contacts" className="hover:text-foreground transition-colors" data-testid="link-contacts">Контакты</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors" data-testid="link-privacy">Конфиденциальность</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors" data-testid="link-terms">Условия</Link>
              <Link href="/refund" className="hover:text-foreground transition-colors" data-testid="link-refund">Возвраты</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            <p>ИП Альтаев Г.Т. | г. Алматы, пр. Гагарина 132</p>
            <p className="mt-1">&copy; {new Date().getFullYear()} SmartCatalog. Все права защищены.</p>
          </div>
        </div>
      </footer>

      {/* WhatsApp Widget */}
      {createPortal(
        <a
          href="https://wa.me/77773875355"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 99999,
            width: "56px",
            height: "56px",
            backgroundColor: "#25D366",
            color: "white",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            textDecoration: "none",
          }}
          data-testid="button-whatsapp-widget"
          aria-label="Написать в WhatsApp"
        >
          <SiWhatsapp style={{ width: "28px", height: "28px" }} />
        </a>,
        document.body
      )}
    </div>
  );
}
