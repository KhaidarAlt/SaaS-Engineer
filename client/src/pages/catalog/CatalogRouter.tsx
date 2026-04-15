import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import CatalogHome from "./CatalogHome";
import FashionCatalog from "./FashionCatalog";
import FoodCatalog from "./FoodCatalog";
import { useCatalogSlug } from "@/hooks/useCatalogSlug";
import type { Tenant, Product, Category, Promotion, PromoBlock } from "@shared/schema";

interface ProductWithPrice extends Product {
  computedPrice: string;
  originalPrice: string;
  discountPercent: number | null;
  discountType: string | null;
  hasDiscount: boolean;
  promotionName?: string;
  discountName?: string;
}

interface CatalogData {
  tenant: Tenant & { catalogTemplate?: string };
  products: ProductWithPrice[];
  categories: Category[];
  promotions: Promotion[];
}

export default function CatalogRouter() {
  const { slug, basePath } = useCatalogSlug("/c/:slug");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wp = params.get("wp");
    if (wp) {
      sessionStorage.setItem("whatsappPhone", wp.replace(/\D/g, ""));
    }
  }, []);

  const { data, isLoading, error } = useQuery<CatalogData>({
    queryKey: ["/api/catalog", slug],
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">Каталог не найден</p>
          <p className="text-sm text-muted-foreground">Проверьте ссылку и попробуйте снова</p>
        </div>
      </div>
    );
  }

  const tenant = data.tenant as any;
  const template = tenant.catalogTemplate || "universal";
  const isDemo = tenant.status === "demo" && tenant.importSource?.startsWith("telegram:");
  const isSuspended = tenant.status === "suspended";

  if (isSuspended) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold" data-testid="heading-suspended">
            Каталог временно недоступен
          </h1>
          <p className="text-muted-foreground">
            Пробный период истёк. Свяжитесь с владельцем магазина для активации.
          </p>
          {tenant.contactPhone && (
            <a
              href={`https://wa.me/${tenant.contactPhone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              data-testid="link-whatsapp-contact"
            >
              <ExternalLink className="h-4 w-4" />
              Написать в WhatsApp
            </a>
          )}
        </div>
      </div>
    );
  }

  const platformDomain = import.meta.env.VITE_PLATFORM_DOMAIN || "botfactory.kz";
  const magicImportUrl = `https://${platformDomain}/magic-import`;

  const demoBanner = isDemo ? (
    <div className="bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 px-4 py-2 text-center text-sm text-amber-800 dark:text-amber-300" data-testid="banner-demo">
      <AlertTriangle className="h-3.5 w-3.5 inline-block mr-1.5 -mt-0.5" />
      Демо-режим: до 20 товаров.{" "}
      <a href={magicImportUrl} className="font-medium underline hover:no-underline" data-testid="link-activate-full">
        Активируйте полную версию →
      </a>
    </div>
  ) : null;

  if (template === "fashion") {
    return (
      <>
        {demoBanner}
        <FashionCatalog
          slug={slug}
          basePath={basePath}
          tenant={data.tenant}
          products={data.products}
          categories={data.categories}
        />
      </>
    );
  }

  if (template === "food") {
    return (
      <>
        {demoBanner}
        <FoodCatalog
          slug={slug}
          basePath={basePath}
          tenant={data.tenant}
          products={data.products}
          categories={data.categories}
        />
      </>
    );
  }

  return (
    <>
      {demoBanner}
      <CatalogHome basePath={basePath} />
    </>
  );
}
