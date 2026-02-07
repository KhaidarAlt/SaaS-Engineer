import { useRoute } from "wouter";
import { useCustomDomain } from "@/App";

export function useCatalogSlug(routePattern: string) {
  const [, routeParams] = useRoute(routePattern);
  const { customDomain, slug: domainSlug } = useCustomDomain();

  const slug = routeParams?.slug || (customDomain ? domainSlug : "") || "";
  const basePath = customDomain && domainSlug ? "" : `/c/${slug}`;

  return { slug, basePath };
}
