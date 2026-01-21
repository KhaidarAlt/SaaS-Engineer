import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Send, CheckCircle2, Package, MessageCircle, Sparkles } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";
import { apiRequest } from "@/lib/queryClient";
import { checkoutSchema, type CheckoutInput } from "@shared/schema";
import { WhatsAppSendButton } from "@/components/WhatsAppSendButton";
import { trackEvent, updateCartSession, convertCartSession } from "@/lib/analytics";
import type { OrderForWhatsApp } from "@/lib/whatsapp";
import { normalizeKzPhoneToWhatsApp, formatKzt } from "@/lib/whatsapp";

interface OrderResponse {
  orderId: string;
  orderNumber: string;
  ownerWhatsAppPhone: string | null;
  order: {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string | null;
    deliveryAddress: string | null;
    comment: string | null;
    subtotal: string;
    discountTotal: string;
    total: string;
    createdAt: string;
    items: Array<{
      productId: string;
      productName: string;
      productSku: string;
      quantity: number;
      unitPrice: string;
      total: string;
    }>;
  };
  catalogUrl: string;
}

export default function CheckoutPage() {
  const [, params] = useRoute("/c/:slug/checkout");
  const slug = params?.slug || "";
  const { items, subtotal, clearCart } = useCart();
  const { toast } = useToast();
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderData, setOrderData] = useState<OrderResponse | null>(null);
  
  const trackedRef = useRef(false);
  useEffect(() => {
    if (slug && !trackedRef.current && items.length > 0) {
      trackedRef.current = true;
      trackEvent({ tenantSlug: slug, eventType: 'checkout_start' });
      updateCartSession({
        tenantSlug: slug,
        cartJson: items.map(i => ({
          productId: i.product.id,
          name: i.product.name,
          qty: i.quantity,
          price: parseFloat(i.product.price),
        })),
        totalEstimated: subtotal,
        lastStep: 'checkout',
      });
    }
  }, [slug, items, subtotal]);

  const form = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      deliveryAddress: "",
      comment: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: CheckoutInput) => {
      const orderPayload = {
        ...data,
        tenantSlug: slug,
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      };
      return apiRequest("POST", "/api/orders", orderPayload);
    },
    onSuccess: async (response) => {
      const data: OrderResponse = await response.json();
      setOrderData(data);
      setOrderSuccess(true);
      clearCart();
      trackEvent({ 
        tenantSlug: slug, 
        eventType: 'order_created',
        orderId: data.orderId,
        metadata: { orderNumber: data.orderNumber, total: data.order.total },
      });
      convertCartSession(slug, data.orderId);
    },
    onError: (error) => {
      toast({
        title: "Ошибка оформления",
        description: error instanceof Error ? error.message : "Попробуйте позже",
        variant: "destructive",
      });
    },
  });

  const buildWhatsAppOrder = (): OrderForWhatsApp | null => {
    if (!orderData) return null;
    const order = orderData.order;
    return {
      orderNumber: order.orderNumber,
      createdAtISO: order.createdAt,
      currencySymbol: "₸",
      items: order.items.map((item) => ({
        name: item.productName,
        qty: item.quantity,
        unitPrice: parseFloat(item.unitPrice),
        lineTotal: parseFloat(item.total),
      })),
      subtotal: parseFloat(order.subtotal),
      discountTotal: parseFloat(order.discountTotal),
      total: parseFloat(order.total),
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.deliveryAddress || undefined,
      comment: order.comment || undefined,
      catalogUrl: orderData.catalogUrl,
    };
  };

  const onSubmit = (data: CheckoutInput) => {
    mutation.mutate(data);
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("ru-KZ").format(value) + " ₸";
  };

  // Build WhatsApp URL for demo orders (send to customer's own phone)
  const buildDemoWhatsAppUrl = () => {
    if (!orderData) return null;
    const order = orderData.order;
    const customerPhone = order.customerPhone;
    
    // Build demo order text
    const lines: string[] = [];
    lines.push(`Ваш заказ №${order.orderNumber} оформлен!`);
    lines.push(`Дата: ${new Date(order.createdAt).toLocaleString("ru-RU")}`);
    lines.push(`------------------------------`);
    
    order.items.forEach((it, idx) => {
      lines.push(
        `${idx + 1}) ${it.productName} — ${it.quantity} шт × ${formatKzt(parseFloat(it.unitPrice))} ₸ = ${formatKzt(parseFloat(it.total))} ₸`
      );
    });
    
    lines.push(`------------------------------`);
    if (parseFloat(order.discountTotal) > 0) {
      lines.push(`Скидка: -${formatKzt(parseFloat(order.discountTotal))} ₸`);
    }
    lines.push(`Итого: ${formatKzt(parseFloat(order.total))} ₸`);
    
    if (order.deliveryAddress) {
      lines.push("");
      lines.push(`Адрес доставки: ${order.deliveryAddress}`);
    }
    if (order.comment) {
      lines.push(`Комментарий: ${order.comment}`);
    }
    
    lines.push("");
    lines.push("Это демо-заказ от BotFactory.");
    lines.push("Попробуйте создать свой каталог бесплатно:");
    lines.push("https://botfactory.kz");
    
    const text = lines.join("\n");
    
    try {
      const normalized = normalizeKzPhoneToWhatsApp(customerPhone);
      return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
    } catch {
      return null;
    }
  };

  if (orderSuccess && orderData) {
    const whatsAppOrder = buildWhatsAppOrder();
    const isDemo = slug === "demo";
    const demoWhatsAppUrl = isDemo ? buildDemoWhatsAppUrl() : null;
    
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-xl w-full"
        >
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          
          {isDemo ? (
            <>
              <h1 className="text-2xl font-bold mb-2">Заказ создан!</h1>
              <p className="text-muted-foreground mb-6">
                Номер заказа: <strong>#{orderData.orderNumber}</strong>
              </p>
              
              {demoWhatsAppUrl && (
                <div className="mb-6 space-y-3">
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      <span className="font-semibold">Вот как это работает!</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Нажмите кнопку ниже, чтобы получить заказ себе в WhatsApp
                    </p>
                    <a href={demoWhatsAppUrl} target="_blank" rel="noopener noreferrer">
                      <Button className="w-full bg-[#25D366] text-white" data-testid="button-demo-whatsapp">
                        <SiWhatsapp className="w-5 h-5 mr-2" />
                        Получить заказ в WhatsApp
                      </Button>
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    В реальном магазине заказ приходит владельцу автоматически
                  </p>
                </div>
              )}
              
              <div className="space-y-3">
                <Link href="/register">
                  <Button className="w-full" data-testid="button-create-catalog">
                    Создать свой каталог бесплатно
                  </Button>
                </Link>
                <Link href={`/c/${slug}`}>
                  <Button variant="outline" className="w-full" data-testid="button-continue-shopping">
                    Вернуться к каталогу
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-2">Спасибо! Заказ создан.</h1>
              <p className="text-muted-foreground mb-6">
                Номер вашего заказа: <strong>#{orderData.orderNumber}</strong>
              </p>
              
              {whatsAppOrder && (
                <div className="mb-6">
                  <WhatsAppSendButton 
                    recipientPhone={orderData.ownerWhatsAppPhone}
                    order={whatsAppOrder}
                    tenantSlug={slug}
                    orderId={orderData.orderId}
                  />
                </div>
              )}

              <p className="text-sm text-muted-foreground mb-6">
                Мы свяжемся с вами для подтверждения заказа
              </p>
              <Link href={`/c/${slug}`}>
                <Button variant="outline" data-testid="button-continue-shopping">
                  Вернуться к каталогу
                </Button>
              </Link>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <Package className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Корзина пуста</h1>
          <p className="text-muted-foreground mb-6">
            Добавьте товары для оформления заказа
          </p>
          <Link href={`/c/${slug}`}>
            <Button>Перейти к каталогу</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/95 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href={`/c/${slug}/cart`}>
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <h1 className="text-xl font-bold tracking-tight">Оформление заказа</h1>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        {/* Demo banner */}
        {slug === "demo" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border border-primary/20 rounded-lg p-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <MessageCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold mb-1">Попробуйте сами!</p>
                <p className="text-sm text-muted-foreground">
                  Введите свой WhatsApp номер и оформите заказ. После оформления вы получите заказ себе в мессенджер — так это работает для владельцев магазинов.
                </p>
              </div>
            </div>
          </motion.div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-3"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Контактные данные</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customerName">Ваше имя *</Label>
                    <Input
                      id="customerName"
                      placeholder="Иван Иванов"
                      {...form.register("customerName")}
                      data-testid="input-name"
                    />
                    {form.formState.errors.customerName && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.customerName.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customerPhone">Телефон *</Label>
                    <Input
                      id="customerPhone"
                      type="tel"
                      placeholder="+7 (777) 123-45-67"
                      {...form.register("customerPhone")}
                      data-testid="input-phone"
                    />
                    {form.formState.errors.customerPhone && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.customerPhone.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customerEmail">Email</Label>
                    <Input
                      id="customerEmail"
                      type="email"
                      placeholder="email@example.com"
                      {...form.register("customerEmail")}
                      data-testid="input-email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deliveryAddress">Адрес доставки</Label>
                    <Textarea
                      id="deliveryAddress"
                      placeholder="Город, улица, дом, квартира"
                      {...form.register("deliveryAddress")}
                      data-testid="input-address"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="comment">Комментарий к заказу</Label>
                    <Textarea
                      id="comment"
                      placeholder="Особые пожелания, время доставки..."
                      {...form.register("comment")}
                      data-testid="input-comment"
                    />
                  </div>

                  <div className="pt-4">
                    <Button
                      type="submit"
                      className="w-full h-12 text-base"
                      disabled={mutation.isPending}
                      data-testid="button-submit"
                    >
                      {mutation.isPending ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                          Оформление...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Send className="h-4 w-4" />
                          Оформить заказ
                        </span>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2"
          >
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Ваш заказ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item) => (
                  <div key={item.product.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.product.name} × {item.quantity}
                    </span>
                    <span>
                      {formatPrice(parseFloat(item.product.price) * item.quantity)}
                    </span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Итого</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  После оформления вы сможете отправить заказ в WhatsApp
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
