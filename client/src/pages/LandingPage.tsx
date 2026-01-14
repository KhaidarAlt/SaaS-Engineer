import { Link } from "wouter";
import { motion } from "framer-motion";
import { 
  Store, 
  ShoppingCart, 
  MessageCircle, 
  BarChart3, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";

const features = [
  {
    icon: Store,
    title: "Красивый каталог",
    description: "Создайте профессиональный онлайн-каталог товаров за минуты. Без кода и дизайнеров.",
  },
  {
    icon: ShoppingCart,
    title: "Приём заказов",
    description: "Корзина, оформление заказа и автоматическая отправка в WhatsApp одной кнопкой.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp интеграция",
    description: "Заказы мгновенно приходят в WhatsApp. Подключение через QR-код за 30 секунд.",
  },
  {
    icon: Sparkles,
    title: "AI-ассистент",
    description: "Умный помощник отвечает клиентам на основе вашего каталога и базы знаний.",
  },
  {
    icon: BarChart3,
    title: "Аналитика продаж",
    description: "Отслеживайте посещения, конверсии, брошенные корзины и выручку в реальном времени.",
  },
  {
    icon: Zap,
    title: "Быстрый старт",
    description: "Импортируйте товары из Excel или CSV. Умное распознавание колонок.",
  },
];

const plans = [
  {
    name: "Старт",
    price: "19 900",
    period: "в месяц",
    description: "Для малого бизнеса",
    features: [
      "До 300 товаров",
      "До 30 категорий",
      "WhatsApp интеграция",
      "AI-ассистент (500 сообщ./мес)",
      "Базовая аналитика",
    ],
  },
  {
    name: "Про",
    price: "49 900",
    period: "в месяц",
    description: "Для растущего бизнеса",
    popular: true,
    features: [
      "До 3 000 товаров",
      "До 200 категорий",
      "До 3 WhatsApp каналов",
      "AI-ассистент (5 000 сообщ./мес)",
      "Расширенная аналитика",
      "До 5 менеджеров",
    ],
  },
  {
    name: "Бизнес",
    price: "99 900",
    period: "в месяц",
    description: "Для крупного бизнеса",
    features: [
      "До 20 000 товаров",
      "До 1 000 категорий",
      "До 10 WhatsApp каналов",
      "AI-ассистент (20 000 сообщ./мес)",
      "Полная аналитика",
      "До 20 менеджеров",
    ],
  },
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Store className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold tracking-tight">SmartCatalog</span>
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
                    <Button variant="ghost" data-testid="button-login">Войти</Button>
                  </Link>
                  <Link href="/register">
                    <Button data-testid="button-register">Начать бесплатно</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="py-20 lg:py-32">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="text-center max-w-4xl mx-auto"
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
                Умный каталог товаров{" "}
                <span className="text-primary">для вашего бизнеса</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                Создайте красивый онлайн-каталог, принимайте заказы через WhatsApp 
                и используйте AI-ассистента для автоматизации продаж
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/register">
                  <Button size="lg" className="h-14 px-8 text-lg" data-testid="button-hero-start">
                    Создать каталог бесплатно
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/c/demo">
                  <Button size="lg" variant="outline" className="h-14 px-8 text-lg" data-testid="button-demo">
                    Посмотреть демо
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="py-20 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Всё для онлайн-продаж
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                От каталога до аналитики — полный набор инструментов в одном месте
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className="h-full hover-elevate">
                    <CardContent className="p-6">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                        <feature.icon className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20" id="pricing">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Простые тарифы
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Выберите план, который подходит вашему бизнесу
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {plans.map((plan, index) => (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="relative"
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                      <span className="bg-primary text-primary-foreground text-sm font-medium px-4 py-1.5 rounded-full">
                        Популярный
                      </span>
                    </div>
                  )}
                  <Card className={`h-full ${plan.popular ? "ring-2 ring-primary" : ""}`}>
                    <CardContent className="p-6 lg:p-8">
                      <div className="text-center mb-6">
                        <h3 className="text-xl font-semibold mb-1">{plan.name}</h3>
                        <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-4xl font-bold">{plan.price}</span>
                          <span className="text-muted-foreground">₸</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{plan.period}</p>
                      </div>
                      <ul className="space-y-3 mb-8">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <span className="text-sm">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Link href="/register">
                        <Button
                          className="w-full"
                          variant={plan.popular ? "default" : "outline"}
                          data-testid={`button-plan-${plan.name.toLowerCase()}`}
                        >
                          Начать
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 bg-primary text-primary-foreground">
          <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Готовы начать?
              </h2>
              <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
                Создайте свой онлайн-каталог прямо сейчас. Бесплатный период 14 дней.
              </p>
              <Link href="/register">
                <Button size="lg" variant="secondary" className="h-14 px-8 text-lg" data-testid="button-cta">
                  Создать каталог бесплатно
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              <span className="font-semibold">SmartCatalog</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 SmartCatalog. Все права защищены.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
