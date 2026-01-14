import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Send, CheckCircle2, Package, MessageCircle } from "lucide-react";
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

export default function CheckoutPage() {
  const [, params] = useRoute("/c/:slug/checkout");
  const [, setLocation] = useLocation();
  const slug = params?.slug || "";
  const { items, subtotal, clearCart } = useCart();
  const { toast } = useToast();
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");

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
      const orderData = {
        ...data,
        tenantSlug: slug,
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      };
      return apiRequest("POST", "/api/orders", orderData);
    },
    onSuccess: async (response) => {
      const data = await response.json();
      setOrderNumber(data.orderNumber);
      setOrderSuccess(true);
      clearCart();
    },
    onError: (error) => {
      toast({
        title: "Ошибка оформления",
        description: error instanceof Error ? error.message : "Попробуйте позже",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CheckoutInput) => {
    mutation.mutate(data);
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("ru-KZ").format(value) + " ₸";
  };

  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Заказ оформлен!</h1>
          <p className="text-muted-foreground mb-4">
            Номер вашего заказа: <strong>#{orderNumber}</strong>
          </p>
          <div className="p-4 rounded-lg bg-muted mb-6">
            <div className="flex items-center gap-2 text-sm">
              <MessageCircle className="h-5 w-5 text-green-500" />
              <span>Информация о заказе отправлена в WhatsApp</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Мы свяжемся с вами для подтверждения заказа
          </p>
          <Link href={`/c/${slug}`}>
            <Button data-testid="button-continue-shopping">
              Вернуться к каталогу
            </Button>
          </Link>
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
                <div className="pt-2 p-3 rounded-lg bg-green-500/10 text-sm">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-green-500" />
                    <span>Заказ придёт в WhatsApp</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
