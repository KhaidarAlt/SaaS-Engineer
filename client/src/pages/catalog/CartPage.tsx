import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Minus, Plus, Trash2, ShoppingCart, Package, MessageCircle } from "lucide-react";
import { resolveImageUrl } from "@/lib/imageUrl";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useCart } from "@/contexts/CartContext";
import { trackEvent, updateCartSession } from "@/lib/analytics";
import { useCatalogSlug } from "@/hooks/useCatalogSlug";

export default function CartPage() {
  const { slug, basePath } = useCatalogSlug("/c/:slug/cart");
  const [, setLocation] = useLocation();
  const { items, updateQuantity, removeItem, subtotal, totalItems, clearCart } = useCart();
  
  const trackedRef = useRef(false);
  useEffect(() => {
    if (slug && !trackedRef.current) {
      trackedRef.current = true;
      trackEvent({ tenantSlug: slug, eventType: 'cart_view' });
    }
  }, [slug]);
  
  useEffect(() => {
    if (slug && items.length > 0) {
      updateCartSession({
        tenantSlug: slug,
        cartJson: items.map(i => ({
          productId: i.product.id,
          name: i.product.name,
          qty: i.quantity,
          price: parseFloat(i.product.price),
        })),
        totalEstimated: subtotal,
        lastStep: 'cart',
      });
    }
  }, [slug, items, subtotal]);

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("ru-KZ").format(value) + " ₸";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/95 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href={basePath || "/"}>
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <h1 className="text-xl font-bold tracking-tight">Корзина</h1>
            </div>
            <ThemeToggle variant="catalog" />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        {/* Demo banner */}
        {slug === "demo" && items.length > 0 && (
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
                <p className="font-semibold mb-1">Оформите заказ и получите его в WhatsApp</p>
                <p className="text-sm text-muted-foreground">
                  Введите свой номер при оформлении — заказ придёт вам в мессенджер
                </p>
              </div>
            </div>
          </motion.div>
        )}
        
        {items.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              {items.map((item, index) => (
                <motion.div
                  key={item.product.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <div className="w-20 h-20 rounded-lg bg-muted overflow-hidden shrink-0">
                          {item.product.mainImageUrl ? (
                            <img
                              src={resolveImageUrl(item.product.mainImageUrl)}
                              alt={item.product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-8 w-8 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium line-clamp-2">{item.product.name}</h3>
                          <p className="text-sm text-muted-foreground">{item.product.sku}</p>
                          <p className="text-lg font-bold mt-1">
                            {formatPrice(parseFloat(item.product.price))}
                          </p>
                        </div>
                        <div className="flex flex-col items-end justify-between">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => removeItem(item.product.id)}
                            data-testid={`button-remove-${item.product.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                updateQuantity(item.product.id, item.quantity - 1)
                              }
                              data-testid={`button-minus-${item.product.id}`}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                updateQuantity(item.product.id, item.quantity + 1)
                              }
                              data-testid={`button-plus-${item.product.id}`}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Итого</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Товаров</span>
                  <span>{totalItems} шт.</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Сумма</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="pt-4 space-y-2">
                  <Link href={`${basePath}/checkout`}>
                    <Button className="w-full h-12 text-base" data-testid="button-checkout">
                      Оформить заказ
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={clearCart}
                    data-testid="button-clear-cart"
                  >
                    Очистить корзину
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <ShoppingCart className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Корзина пуста</h2>
            <p className="text-muted-foreground mb-6">
              Добавьте товары из каталога
            </p>
            <Link href={basePath || "/"}>
              <Button data-testid="button-to-catalog">
                Перейти к каталогу
              </Button>
            </Link>
          </motion.div>
        )}
      </main>
    </div>
  );
}
