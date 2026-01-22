import { motion } from "framer-motion";
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
  Percent,
  Image,
  Grid3X3,
  Palette,
  Sparkles,
  Globe,
  FileSpreadsheet,
  ArrowRight,
  Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";

const fadeInUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.6, ease: "easeOut" }
};

const staggerContainer = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.1 } },
  viewport: { once: true }
};

const staggerItem = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">BotFactory</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {user ? (
              <Link href="/dashboard">
                <Button data-testid="button-dashboard">Личный кабинет</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" data-testid="link-login">
                    Войти
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" data-testid="button-register-header">
                    Создать каталог
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container mx-auto px-4 relative">
          <motion.div 
            className="max-w-4xl mx-auto text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Badge variant="secondary" className="mb-6">
              <Sparkles className="w-3 h-3 mr-1" />
              AI-powered
            </Badge>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-4 leading-tight">
              Преврати <span className="text-primary">WhatsApp</span><br />
              в интернет-магазин
            </h1>
            <p className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight">
              Без программистов за 1 час.
            </p>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Красивый онлайн-каталог, автоматический приём заказов
              и AI-ассистент, который продаёт за вас 24/7.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <Link href="/register">
                <Button size="lg" className="text-lg px-8 h-14" data-testid="button-hero-cta">
                  Создать каталог бесплатно
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/c/demo">
                <Button size="lg" variant="outline" className="text-lg px-8 h-14" data-testid="button-hero-demo">
                  Посмотреть пример магазина
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              Без карты. Без программирования. Бесплатно до 20 товаров навсегда.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Почему бизнес теряет заказы в WhatsApp
            </h2>
          </motion.div>
          <motion.div 
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {[
              { icon: MessageSquare, text: "Клиенты теряются в переписках" },
              { icon: Package, text: "Нет единого каталога товаров" },
              { icon: ShoppingCart, text: "Заказы принимаются хаотично" },
              { icon: Clock, text: "Менеджеры не успевают отвечать" },
              { icon: BarChart3, text: "Нет контроля и аналитики" },
              { icon: Layers, text: "Нет системы — только чаты" }
            ].map((item, i) => (
              <motion.div key={i} variants={staggerItem}>
                <Card className="h-full hover-elevate">
                  <CardContent className="pt-6 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                      <item.icon className="w-5 h-5 text-destructive" />
                    </div>
                    <p className="text-lg font-medium">{item.text}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
          <motion.p 
            {...fadeInUp} 
            className="text-center mt-12 text-xl text-muted-foreground"
          >
            WhatsApp есть у всех. Проблема — в отсутствии системы.
          </motion.p>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="max-w-3xl mx-auto text-center">
            <Badge variant="secondary" className="mb-4">Решение</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Готовый интернет-магазин внутри WhatsApp
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              BotFactory превращает WhatsApp в полноценный интернет-магазин.
              Вы создаёте каталог, клиенты оформляют заказ,
              а заявки приходят прямо в WhatsApp и встроенную CRM.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm font-medium">
              <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full">
                <X className="w-4 h-4" /> Без сайтов
              </div>
              <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full">
                <X className="w-4 h-4" /> Без сложных настроек
              </div>
              <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full">
                <Check className="w-4 h-4" /> Работает сразу
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Catalog Features */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Каталог, который реально продаёт
            </h2>
            <p className="text-muted-foreground">
              Ваш каталог выглядит как полноценный интернет-магазин
            </p>
          </motion.div>
          <motion.div 
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {[
              { icon: Zap, title: "Быстрая загрузка", desc: "Загрузка товаров за секунды" },
              { icon: FileSpreadsheet, title: "Импорт из Excel", desc: "Массовая загрузка каталога" },
              { icon: Image, title: "Много фото", desc: "Несколько фото для товара" },
              { icon: Grid3X3, title: "Категории", desc: "Удобная структура каталога" },
              { icon: Palette, title: "Размеры и цвета", desc: "Вариации товаров" },
              { icon: Percent, title: "Скидки и акции", desc: "Гибкое ценообразование" },
              { icon: ShoppingCart, title: "Корзина", desc: "Оформление заказа" },
              { icon: Sparkles, title: "Современный дизайн", desc: "Красивые анимации" }
            ].map((item, i) => (
              <motion.div key={i} variants={staggerItem}>
                <Card className="h-full text-center hover-elevate">
                  <CardContent className="pt-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <item.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Как это работает
            </h2>
          </motion.div>
          <motion.div 
            className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {[
              { step: 1, icon: Package, title: "Загружаете товары", desc: "Добавляете товары вручную или импортируете из Excel" },
              { step: 2, icon: Globe, title: "Делитесь ссылкой", desc: "Отправляете ссылку на каталог клиентам" },
              { step: 3, icon: ShoppingCart, title: "Клиент заказывает", desc: "Клиент выбирает товары и оформляет заказ" },
              { step: 4, icon: MessageSquare, title: "Заявка в WhatsApp", desc: "Вы получаете заказ в WhatsApp и CRM" }
            ].map((item, i) => (
              <motion.div key={i} variants={staggerItem} className="text-center relative">
                {i < 3 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
                )}
                <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-2xl font-bold relative z-10">
                  {item.step}
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CRM Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
            <motion.div {...fadeInUp}>
              <Badge variant="secondary" className="mb-4">CRM</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Встроенная CRM — всё под контролем
              </h2>
              <div className="space-y-4">
                {[
                  "Все заказы в одном месте",
                  "История клиентов",
                  "Статусы заявок",
                  "Контроль обработки заказов",
                  "Ничего не теряется"
                ].map((text, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-lg">{text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div {...fadeInUp} className="relative">
              <Card className="p-6">
                <div className="space-y-3">
                  {[
                    { status: "Новый", color: "bg-blue-500", name: "Заказ #1234", time: "2 мин назад" },
                    { status: "В работе", color: "bg-yellow-500", name: "Заказ #1233", time: "15 мин назад" },
                    { status: "Выполнен", color: "bg-green-500", name: "Заказ #1232", time: "1 час назад" }
                  ].map((order, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${order.color}`} />
                        <span className="font-medium">{order.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{order.status}</Badge>
                        <span className="text-xs text-muted-foreground">{order.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* AI Assistant Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
            <motion.div {...fadeInUp} className="order-2 lg:order-1">
              <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5">
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-2">
                      <p className="text-sm">Здравствуйте! Какие размеры есть у кроссовок Nike Air Max?</p>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-none px-4 py-2 max-w-[80%]">
                      <p className="text-sm">Добрый день! Nike Air Max доступны в размерах 39-45. Стоимость 45 900 ₸. Сейчас действует скидка 15%! Хотите оформить заказ?</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-primary-foreground" />
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
            <motion.div {...fadeInUp} className="order-1 lg:order-2">
              <Badge variant="secondary" className="mb-4">
                <Bot className="w-3 h-3 mr-1" />
                AI
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                AI-ассистент, который продаёт за вас
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                AI-ассистент общается с клиентами, помогает выбрать товар и доводит до заказа.
              </p>
              <div className="space-y-3">
                {[
                  "Работает 24/7",
                  "Общается на русском, казахском и английском",
                  "Знает ваш каталог, цены и акции",
                  "Следует готовому скрипту продаж",
                  "Не выходит за рамки ваших данных",
                  "Передаёт диалог менеджеру при необходимости"
                ].map((text, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary shrink-0" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-lg font-medium text-primary">
                Вы занимаетесь бизнесом — AI ведёт продажи.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Analytics Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">Аналитика</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Аналитика, которая помогает зарабатывать больше
            </h2>
          </motion.div>
          <motion.div 
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {[
              { value: "1,234", label: "Переходы в каталог", trend: "+12%" },
              { value: "456", label: "Добавления в корзину", trend: "+8%" },
              { value: "89", label: "Оформленные заказы", trend: "+15%" },
              { value: "2.4M ₸", label: "Общая сумма заказов", trend: "+23%" }
            ].map((stat, i) => (
              <motion.div key={i} variants={staggerItem}>
                <Card className="text-center hover-elevate">
                  <CardContent className="pt-6">
                    <div className="text-3xl font-bold mb-1">{stat.value}</div>
                    <div className="text-sm text-muted-foreground mb-2">{stat.label}</div>
                    <Badge variant="secondary" className="text-green-600">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      {stat.trend}
                    </Badge>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Sales Growth Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Инструменты роста среднего чека и лояльности
            </h2>
          </motion.div>
          <motion.div 
            className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6 max-w-6xl mx-auto"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {[
              { icon: Percent, title: "Скидки и акции" },
              { icon: Sparkles, title: "Умные рекомендации" },
              { icon: ShoppingCart, title: "Брошенные корзины" },
              { icon: Clock, title: "Повторные заказы" },
              { icon: Users, title: "Лояльность клиентов" }
            ].map((item, i) => (
              <motion.div key={i} variants={staggerItem}>
                <Card className="text-center h-full hover-elevate">
                  <CardContent className="pt-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <item.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-medium text-sm">{item.title}</h3>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Простые и понятные тарифы
            </h2>
          </motion.div>
          <motion.div 
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {/* Старт */}
            <motion.div variants={staggerItem}>
              <Card className="h-full flex flex-col">
                <CardHeader>
                  <CardTitle>Старт</CardTitle>
                  <CardDescription>Для начала</CardDescription>
                  <div className="pt-4">
                    <span className="text-4xl font-bold">0 ₸</span>
                    <span className="text-muted-foreground"> / навсегда</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>Каталог до 20 товаров</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>Приём заявок в WhatsApp</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>Публичная ссылка</span>
                    </li>
                    <li className="flex items-start gap-2 text-muted-foreground">
                      <X className="w-5 h-5 shrink-0 mt-0.5" />
                      <span>Без аналитики</span>
                    </li>
                    <li className="flex items-start gap-2 text-muted-foreground">
                      <X className="w-5 h-5 shrink-0 mt-0.5" />
                      <span>Без CRM</span>
                    </li>
                    <li className="flex items-start gap-2 text-muted-foreground">
                      <X className="w-5 h-5 shrink-0 mt-0.5" />
                      <span>Без AI</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link href="/register" className="w-full">
                    <Button variant="outline" className="w-full" data-testid="button-pricing-free">
                      Начать бесплатно
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            </motion.div>

            {/* Каталог */}
            <motion.div variants={staggerItem}>
              <Card className="h-full flex flex-col">
                <CardHeader>
                  <CardTitle>Каталог</CardTitle>
                  <CardDescription>Для активных продаж</CardDescription>
                  <div className="pt-4">
                    <span className="text-4xl font-bold">9 990 ₸</span>
                    <span className="text-muted-foreground"> / месяц</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>Полноценный каталог</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>Категории и вариации</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>Скидки и акции</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>Встроенная CRM</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>Полная аналитика</span>
                    </li>
                    <li className="flex items-start gap-2 text-muted-foreground">
                      <X className="w-5 h-5 shrink-0 mt-0.5" />
                      <span>Без AI</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link href="/register" className="w-full">
                    <Button variant="outline" className="w-full" data-testid="button-pricing-catalog">
                      Выбрать
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            </motion.div>

            {/* Business */}
            <motion.div variants={staggerItem}>
              <Card className="h-full flex flex-col">
                <CardHeader>
                  <CardTitle>Business</CardTitle>
                  <CardDescription>AI-ассистент 24/7</CardDescription>
                  <div className="pt-4">
                    <span className="text-4xl font-bold">19 990 ₸</span>
                    <span className="text-muted-foreground"> / месяц</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>Всё из тарифа "Каталог"</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>AI-ассистент 24/7</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>До 300 диалогов/мес</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>Скрипты продаж + база знаний</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>Передача менеджеру по триггерам</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link href="/register" className="w-full">
                    <Button variant="outline" className="w-full" data-testid="button-pricing-business">
                      Выбрать
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            </motion.div>

            {/* PRO */}
            <motion.div variants={staggerItem}>
              <Card className="h-full flex flex-col border-primary relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-bl-lg">
                  Самый выгодный
                </div>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    PRO
                    <Star className="w-5 h-5 text-primary fill-primary" />
                  </CardTitle>
                  <CardDescription>Максимум возможностей</CardDescription>
                  <div className="pt-4">
                    <span className="text-4xl font-bold">34 990 ₸</span>
                    <span className="text-muted-foreground"> / месяц</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>Всё из Business</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>До 900 диалогов/мес</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>Приоритетная обработка диалогов</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>Максимальная автоматизация продаж</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link href="/register" className="w-full">
                    <Button className="w-full" data-testid="button-pricing-pro">
                      Выбрать PRO
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            </motion.div>
          </motion.div>
          <p className="text-center mt-8 text-xs text-muted-foreground max-w-2xl mx-auto">
            * Диалог = общение AI с одним клиентом (уникальный номер) в течение месяца.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div {...fadeInUp} className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Создайте интернет-магазин в WhatsApp уже сегодня
            </h2>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <Link href="/register">
                <Button size="lg" className="text-lg px-8 h-14" data-testid="button-final-cta">
                  Создать каталог бесплатно
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/c/demo">
                <Button size="lg" variant="outline" className="text-lg px-8 h-14" data-testid="button-final-demo">
                  Посмотреть демо
                </Button>
              </Link>
            </div>
            <p className="text-muted-foreground">
              Своими силами. Без карты. С результатом.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">BotFactory</span>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              AI-интернет-магазин в WhatsApp для вашего бизнеса
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors" data-testid="link-contacts">Контакты</a>
              <a href="#" className="hover:text-foreground transition-colors" data-testid="link-privacy">Политика конфиденциальности</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} BotFactory. Все права защищены.
          </div>
        </div>
      </footer>
    </div>
  );
}
