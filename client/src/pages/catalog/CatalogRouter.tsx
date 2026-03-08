import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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

  const template = (data.tenant as any).catalogTemplate || "universal";

  if (template === "fashion") {
    return (
      <FashionCatalog
        slug={slug}
        basePath={basePath}
        tenant={data.tenant}
        products={data.products}
        categories={data.categories}
      />
    );
  }

  if (template === "food") {
    return (
      <FoodCatalog
        slug={slug}
        basePath={basePath}
        tenant={data.tenant}
        products={data.products}
        categories={data.categories}
      />
    );
  }

  return <CatalogHome basePath={basePath} />;
}
