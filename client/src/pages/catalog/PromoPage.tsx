import { useQuery } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { useCatalogSlug } from "@/hooks/useCatalogSlug";
import { motion } from "framer-motion";
import { ArrowLeft, MessageCircle, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { PromoBlock, Tenant } from "@shared/schema";

function normalizeImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("/objects/")) {
    return url;
  }
  return `/objects/${url}`;
}

export default function PromoPage() {
  const [, routeParams] = useRoute("/c/:slug/promo/:promoId");
  const [, rootRouteParams] = useRoute("/promo/:promoId");
  const { slug, basePath } = useCatalogSlug("/c/:slug/promo/:promoId");
  const [, navigate] = useLocation();
  const promoId = routeParams?.promoId || rootRouteParams?.promoId || "";


  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/catalog", slug, "tenant"],
    queryFn: async () => {
      const res = await fetch(`/api/catalog/${slug}`);
      if (!res.ok) throw new Error("Tenant not found");
      const data = await res.json();
      return data.tenant;
    },
    enabled: !!slug,
  });

  const { data: promo, isLoading, error } = useQuery<PromoBlock>({
    queryKey: ["/api/catalog", slug, "promo", promoId],
    queryFn: async () => {
      const res = await fetch(`/api/catalog/${slug}/promo/${promoId}`);
      if (!res.ok) throw new Error("Promo not found");
      return res.json();
    },
    enabled: !!slug && !!promoId,
  });


  const handleCtaClick = async () => {
    await fetch(`/api/catalog/${slug}/promo/${promoId}/cta-click`, {
      method: "POST",
    }).catch(() => {});

    const promoTitle = promo?.title || "Акция";
    const message = encodeURIComponent(`Мне интересна ваша акция "${promoTitle}"`);
    
    const phoneNumber = tenant?.contactPhone?.replace(/\D/g, "") || "";
    if (phoneNumber) {
      window.open(`https://wa.me/${phoneNumber}?text=${message}`, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !promo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">Акция не найдена</p>
        <Button variant="outline" onClick={() => navigate(basePath || "/")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад в каталог
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container max-w-2xl mx-auto px-4 py-3">
          <Link href={basePath || "/"} data-testid="link-back-catalog">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Назад в каталог
            </Button>
          </Link>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {promo.imageUrl && (
            <div className="relative aspect-video rounded-lg overflow-hidden">
              {promo.mediaType === "video" ? (
                <video
                  src={normalizeImageUrl(promo.imageUrl)}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls
                  data-testid="video-promo-banner"
                />
              ) : (
                <img
                  src={normalizeImageUrl(promo.imageUrl)}
                  alt={promo.title || "Промо"}
                  className="w-full h-full object-cover"
                  data-testid="img-promo-banner"
                />
              )}
            </div>
          )}

          <div className="space-y-4">
            {promo.title && (
              <h1 className="text-2xl font-bold" data-testid="text-promo-title">
                {promo.title}
              </h1>
            )}

            {promo.description && (
              <p className="text-muted-foreground leading-relaxed" data-testid="text-promo-description">
                {promo.description}
              </p>
            )}
          </div>

          <div className="pt-4">
            <Button 
              onClick={handleCtaClick}
              size="lg"
              className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold text-lg py-6"
              data-testid="button-promo-cta"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              {promo.buttonText || "Узнать подробнее"}
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
