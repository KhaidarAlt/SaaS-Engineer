import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
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
  ExternalLink,
  Menu,
  X,
  Users,
  Building2,
  Upload,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const tenantNavItems: NavItem[] = [
  { href: "/dashboard", label: "Обзор", icon: LayoutDashboard },
  { href: "/dashboard/products", label: "Товары", icon: Package },
  { href: "/dashboard/categories", label: "Категории", icon: Tag },
  { href: "/dashboard/orders", label: "Заказы", icon: ShoppingCart },
  { href: "/dashboard/discounts", label: "Скидки", icon: Percent },
  { href: "/dashboard/import", label: "Импорт", icon: Upload },
  { href: "/dashboard/ai", label: "AI-ассистент", icon: Bot },
  { href: "/dashboard/analytics", label: "Аналитика", icon: BarChart3 },
  { href: "/dashboard/billing", label: "Биллинг", icon: CreditCard },
  { href: "/dashboard/settings", label: "Настройки", icon: Settings },
];

const superAdminNavItems: NavItem[] = [
  { href: "/admin", label: "Обзор", icon: LayoutDashboard },
  { href: "/admin/tenants", label: "Тенанты", icon: Building2 },
  { href: "/admin/users", label: "Пользователи", icon: Users },
  { href: "/admin/plans", label: "Тарифы", icon: CreditCard },
  { href: "/admin/settings", label: "Настройки", icon: Settings },
];

interface DashboardLayoutProps {
  children: ReactNode;
  isSuperAdmin?: boolean;
}

export function DashboardLayout({ children, isSuperAdmin = false }: DashboardLayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = isSuperAdmin ? superAdminNavItems : tenantNavItems;
  // Add version param based on tenant updatedAt for cache busting in messengers
  const tenantVersion = user?.tenant?.updatedAt ? new Date(user.tenant.updatedAt).getTime() : Date.now();
  const catalogUrl = user?.tenant ? `/c/${(user.tenant as any).slug}?v=${tenantVersion}` : null;

  const handleLogout = async () => {
    await logout();
  };

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = location === item.href || 
      (item.href !== "/dashboard" && item.href !== "/admin" && location.startsWith(item.href));
    
    return (
      <Link href={item.href}>
        <div
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            isActive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
          data-testid={`nav-${item.label.toLowerCase()}`}
        >
          <item.icon className="h-5 w-5" />
          <span>{item.label}</span>
        </div>
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
    </div>
  );
}
