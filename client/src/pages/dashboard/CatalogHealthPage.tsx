import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Image,
  FileText,
  DollarSign,
  FolderOpen,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CardSkeleton } from "@/components/LoadingSpinner";

interface CatalogHealthData {
  score: number;
  totalProducts: number;
  totalCategories: number;
  issues: {
    productsWithoutImages: { count: number; items: { id: string; name: string }[] };
    productsWithoutDescription: { count: number; items: { id: string; name: string }[] };
    productsWithZeroPrice: { count: number; items: { id: string; name: string }[] };
    emptyCategories: { count: number; items: { id: string; name: string }[] };
    inactiveProducts: { count: number; items: { id: string; name: string }[] };
  };
  recommendations: string[];
}

function ScoreCircle({ score }: { score: number }) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-green-500";
    if (s >= 60) return "text-yellow-500";
    if (s >= 40) return "text-orange-500";
    return "text-red-500";
  };

  const getScoreLabel = (s: number) => {
    if (s >= 80) return "Отлично";
    if (s >= 60) return "Хорошо";
    if (s >= 40) return "Требует внимания";
    return "Критично";
  };

  return (
    <div className="relative w-48 h-48 mx-auto">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/20"
        />
        <motion.circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          className={getScoreColor(score)}
          initial={{ strokeDasharray: "0 283" }}
          animate={{ strokeDasharray: `${(score / 100) * 283} 283` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span 
          className={`text-4xl font-bold ${getScoreColor(score)}`}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          {score}
        </motion.span>
        <span className="text-sm text-muted-foreground">из 100</span>
        <Badge variant="secondary" className="mt-2">
          {getScoreLabel(score)}
        </Badge>
      </div>
    </div>
  );
}

function IssueCard({
  title,
  count,
  items,
  icon: Icon,
  severity,
  linkTo,
  index,
}: {
  title: string;
  count: number;
  items: { id: string; name: string }[];
  icon: React.ElementType;
  severity: "critical" | "warning" | "info";
  linkTo: string;
  index: number;
}) {
  const severityColors = {
    critical: "bg-red-500/10 text-red-500 border-red-500/20",
    warning: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    info: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  };

  const severityIcons = {
    critical: XCircle,
    warning: AlertTriangle,
    info: CheckCircle2,
  };

  const SeverityIcon = severityIcons[severity];

  if (count === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
      >
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-green-700 dark:text-green-400">{title}</p>
              <p className="text-sm text-muted-foreground">Проблем нет</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className={`border ${severityColors[severity]}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${severityColors[severity]}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <SeverityIcon className="h-4 w-4 shrink-0" />
                <p className="font-medium">{title}</p>
                <Badge variant="outline" className="ml-auto shrink-0">
                  {count}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                {count} {count === 1 ? "товар" : count < 5 ? "товара" : "товаров"} требуют внимания
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {items.slice(0, 5).map((item) => (
                  <Link key={item.id} href={`/dashboard/products/${item.id}`}>
                    <div className="flex items-center gap-2 text-sm p-2 rounded-md hover:bg-muted/50 cursor-pointer group">
                      <span className="truncate flex-1">{item.name}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                    </div>
                  </Link>
                ))}
                {items.length > 5 && (
                  <p className="text-xs text-muted-foreground px-2">
                    и ещё {items.length - 5}...
                  </p>
                )}
              </div>
              <Link href={linkTo}>
                <Button variant="outline" size="sm" className="mt-3 w-full">
                  Исправить
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function CatalogHealthPage() {
  const { data, isLoading } = useQuery<CatalogHealthData>({
    queryKey: ["/api/catalog-health"],
  });

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Здоровье каталога</h1>
          <p className="text-muted-foreground">
            Анализ качества вашего каталога и рекомендации по улучшению
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : data ? (
          <>
            <div className="grid gap-8 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Общая оценка
                  </CardTitle>
                  <CardDescription>
                    Качество вашего каталога
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScoreCircle score={data.score} />
                  <div className="mt-6 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Товаров</span>
                      <span className="font-medium">{data.totalProducts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Категорий</span>
                      <span className="font-medium">{data.totalCategories}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Рекомендации
                  </CardTitle>
                  <CardDescription>
                    Что сделать, чтобы каталог продавал лучше
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.recommendations.length > 0 ? (
                    <ul className="space-y-3">
                      {data.recommendations.map((rec, i) => (
                        <motion.li 
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                        >
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-medium text-primary">
                            {i + 1}
                          </div>
                          <span>{rec}</span>
                        </motion.li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                      <p className="font-medium text-green-700 dark:text-green-400">
                        Отлично! Ваш каталог в идеальном состоянии
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4">Проблемы каталога</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <IssueCard
                  title="Товары без фото"
                  count={data.issues.productsWithoutImages.count}
                  items={data.issues.productsWithoutImages.items}
                  icon={Image}
                  severity={data.issues.productsWithoutImages.count > 10 ? "critical" : data.issues.productsWithoutImages.count > 0 ? "warning" : "info"}
                  linkTo="/dashboard/products"
                  index={0}
                />
                <IssueCard
                  title="Товары без описания"
                  count={data.issues.productsWithoutDescription.count}
                  items={data.issues.productsWithoutDescription.items}
                  icon={FileText}
                  severity={data.issues.productsWithoutDescription.count > 10 ? "critical" : data.issues.productsWithoutDescription.count > 0 ? "warning" : "info"}
                  linkTo="/dashboard/products"
                  index={1}
                />
                <IssueCard
                  title="Товары с ценой 0"
                  count={data.issues.productsWithZeroPrice.count}
                  items={data.issues.productsWithZeroPrice.items}
                  icon={DollarSign}
                  severity="critical"
                  linkTo="/dashboard/products"
                  index={2}
                />
                <IssueCard
                  title="Пустые категории"
                  count={data.issues.emptyCategories.count}
                  items={data.issues.emptyCategories.items}
                  icon={FolderOpen}
                  severity={data.issues.emptyCategories.count > 0 ? "warning" : "info"}
                  linkTo="/dashboard/categories"
                  index={3}
                />
                <IssueCard
                  title="Неактивные товары"
                  count={data.issues.inactiveProducts.count}
                  items={data.issues.inactiveProducts.items}
                  icon={AlertTriangle}
                  severity={data.issues.inactiveProducts.count > 0 ? "warning" : "info"}
                  linkTo="/dashboard/products"
                  index={4}
                />
              </div>
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Не удалось загрузить данные о здоровье каталога
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
