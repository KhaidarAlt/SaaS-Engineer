import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { motion } from "framer-motion";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TenantLink } from "@shared/schema";

interface LinksPageData {
  tenant: {
    name: string;
    slug: string;
    logoUrl: string | null;
    description: string | null;
  };
  links: TenantLink[];
}

export default function LinksPublicPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, error } = useQuery<LinksPageData>({
    queryKey: ["/api/public/links", slug],
    queryFn: async () => {
      const response = await fetch(`/api/public/links/${slug}`);
      if (!response.ok) throw new Error("Страница не найдена");
      return response.json();
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <h1 className="text-2xl font-bold mb-2">Страница не найдена</h1>
        <p className="text-muted-foreground">Проверьте правильность ссылки</p>
      </div>
    );
  }

  const { tenant, links } = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/50 py-12 px-4">
      <div className="max-w-md mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          {tenant.logoUrl ? (
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-4 border-background shadow-lg"
            />
          ) : (
            <div className="w-24 h-24 rounded-full mx-auto mb-4 bg-primary/10 flex items-center justify-center border-4 border-background shadow-lg">
              <span className="text-3xl font-bold text-primary">
                {tenant.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
          {tenant.description && (
            <p className="text-muted-foreground mt-2 text-sm max-w-xs mx-auto">
              {tenant.description}
            </p>
          )}
        </motion.div>

        <div className="space-y-3">
          {links.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 text-muted-foreground"
            >
              <p>Нет доступных ссылок</p>
            </motion.div>
          ) : (
            links.map((link, index) => (
              <motion.div
                key={link.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                  data-testid={`public-link-${link.id}`}
                >
                  <Button
                    variant="outline"
                    className="w-full h-auto py-4 px-6 text-left justify-between hover-elevate group"
                  >
                    <span className="font-medium">{link.title}</span>
                    <ExternalLink className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </Button>
                </a>
              </motion.div>
            ))
          )}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <a
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Создано на BotFactory
          </a>
        </motion.div>
      </div>
    </div>
  );
}
