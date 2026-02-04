import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Tag,
  Percent,
  BarChart3,
  Settings,
  LogOut,
  CreditCard,
  Wallet,
  ExternalLink,
  Menu,
  Users,
  Upload,
  Bot,
  Activity,
  Lock,
  Gift,
  UserPlus,
  FileText,
  Link2,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { PlanSelectionPopup } from "@/components/PlanSelectionPopup";
import { useToast } from "@/hooks/use-toast";
import type { Plan, Subscription } from "@shared/schema";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  lockForPlans?: string[];
}

const tenantNavItems: NavItem[] = [
  { href: "/dashboard", label: "Обзор", icon: LayoutDashboard },
  { href: "/dashboard/products", label: "Товары", icon: Package },
  { href: "/dashboard/categories", label: "Категории", icon: Tag },
  { href: "/dashboard/orders", label: "Заказы", icon: ShoppingCart },
  { href: "/dashboard/payments", label: "Платежи", icon: Wallet },
  { href: "/dashboard/discounts", label: "Скидки", icon: Percent },
  { href: "/dashboard/promo-zone", label: "Промо-зона", icon: Gift },
  { href: "/dashboard/import", label: "Импорт", icon: Upload, lockForPlans: ["Старт"] },
  { href: "/dashboard/ai", label: "AI-ассистент", icon: Bot, lockForPlans: ["Старт", "Каталог"] },
  { href: "/dashboard/smart-contact", label: "Умный контакт", icon: MessageCircle, lockForPlans: ["Старт", "Каталог"] },
  { href: "/dashboard/integrations", label: "Интеграции", icon: Link2, lockForPlans: ["Старт", "Каталог", "Каталог + AI"] },
  { href: "/dashboard/whatsapp-cloud", label: "WhatsApp Meta", icon: MessageCircle, lockForPlans: ["Старт", "Каталог"] },
  { href: "/dashboard/catalog-health", label: "Здоровье каталога", icon: Activity },
  { href: "/dashboard/links", label: "Мои ссылки", icon: ExternalLink },
  { href: "/dashboard/analytics", label: "Аналитика", icon: BarChart3, lockForPlans: ["Старт"] },
  { href: "/dashboard/billing", label: "Биллинг", icon: CreditCard },
  { href: "/dashboard/settings", label: "Настройки", icon: Settings },
];

const superAdminNavItems: NavItem[] = [
  { href: "/admin", label: "Обзор", icon: LayoutDashboard },
  { href: "/admin/users", label: "Пользователи", icon: Users },
  { href: "/admin/users-free", label: "Пользователи FREE", icon: Gift },
  { href: "/admin/leads", label: "Новый лид", icon: UserPlus },
  { href: "/admin/plan-requests", label: "Заявки на тариф", icon: FileText },
  { href: "/admin/plans", label: "Тарифы", icon: CreditCard },
  { href: "/admin/settings", label: "Настройки", icon: Settings },
];

interface DashboardLayoutProps {
  children: ReactNode;
  isSuperAdmin?: boolean;
}

interface BillingData {
  subscription: Subscription & { plan: Plan };
  daysLeft: number;
}

export function DashboardLayout({ children, isSuperAdmin = false }: DashboardLayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPlanPopup, setShowPlanPopup] = useState(false);

  const { data: billing } = useQuery<BillingData>({
    queryKey: ["/api/billing"],
    enabled: !isSuperAdmin && !!user?.tenantId,
  });

  const currentPlanName = billing?.subscription?.plan?.name || "";

  useEffect(() => {
    // Never show popup for superadmin (check both prop and user role)
    if (isSuperAdmin || !user || user.role === "superadmin") return;

    const createdAt = new Date(user.createdAt);
    const now = new Date();
    const hoursSinceRegistration = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    const popupShown = (user as any).planPopupShown;
    if (hoursSinceRegistration >= 24 && !popupShown) {
      setShowPlanPopup(true);
    }
  }, [user, isSuperAdmin]);

  const navItems = isSuperAdmin ? superAdminNavItems : tenantNavItems;
  const tenantVersion = user?.tenant?.updatedAt ? new Date(user.tenant.updatedAt).getTime() : Date.now();
  const catalogUrl = user?.tenant ? `/c/${(user.tenant as any).slug}?v=${tenantVersion}` : null;

  const handleLogout = async () => {
    await logout();
  };

  const isItemLocked = (item: NavItem): boolean => {
    if (!item.lockForPlans || !currentPlanName) return false;
    return item.lockForPlans.includes(currentPlanName);
  };

  const handleLockedClick = (e: React.MouseEvent, item: NavItem) => {
    if (isItemLocked(item)) {
      e.preventDefault();
      e.stopPropagation();
      toast({
        title: "Функция недоступна",
        description: "Вам нужно апгрейдить ваш тариф в настройках",
      });
    }
  };

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = location === item.href || 
      (item.href !== "/dashboard" && item.href !== "/admin" && location.startsWith(item.href));
    const locked = isItemLocked(item);
    
    const content = (
      <div
        onClick={(e) => handleLockedClick(e, item)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
          locked
            ? "text-muted-foreground/50 cursor-not-allowed"
            : isActive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        }`}
        data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <item.icon className="h-5 w-5" />
        <span className="flex-1">{item.label}</span>
        {locked && <Lock className="h-4 w-4 text-muted-foreground/50" />}
      </div>
    );

    if (locked) {
      return content;
    }

    return (
      <Link href={item.href}>
        {content}
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border">
        <Link href={isSuperAdmin ? "/admin" : "/dashboard"}>
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Package className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">SmartCatalog</h1>
              <p className="text-xs text-muted-foreground">
                {isSuperAdmin ? "Администратор" : user?.tenant?.name || "Мой магазин"}
              </p>
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {catalogUrl && !isSuperAdmin && (
        <div className="p-3 border-t border-sidebar-border">
          <a
            href={catalogUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            data-testid="link-catalog"
          >
            <ExternalLink className="h-5 w-5" />
            <span>Открыть каталог</span>
          </a>
        </div>
      )}

      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="text-xs font-medium">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 mt-2 text-muted-foreground"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="h-5 w-5" />
          <span>Выйти</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:flex w-64 flex-col bg-sidebar border-r border-sidebar-border fixed inset-y-0 left-0 z-30">
        <SidebarContent />
      </aside>

      <div className="flex-1 lg:pl-64">
        <header className="sticky top-0 z-20 h-14 bg-background/95 backdrop-blur-sm border-b border-border flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" data-testid="button-mobile-menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SidebarContent />
              </SheetContent>
            </Sheet>
            <h2 className="font-semibold text-lg hidden sm:block">
              {isSuperAdmin ? "Панель администратора" : "Личный кабинет"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        <main className="p-4 lg:p-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      <PlanSelectionPopup
        open={showPlanPopup}
        onClose={() => setShowPlanPopup(false)}
      />
    </div>
  );
}
