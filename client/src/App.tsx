import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { CartProvider } from "@/contexts/CartContext";
import { PageLoader } from "@/components/LoadingSpinner";
import NotFound from "@/pages/not-found";

import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardOverview from "@/pages/dashboard/DashboardOverview";
import ProductsPage from "@/pages/dashboard/ProductsPage";
import ProductFormPage from "@/pages/dashboard/ProductFormPage";
import CategoriesPage from "@/pages/dashboard/CategoriesPage";
import OrdersPage from "@/pages/dashboard/OrdersPage";
import OrderDetailPage from "@/pages/dashboard/OrderDetailPage";
import DiscountsPage from "@/pages/dashboard/DiscountsPage";
import AnalyticsPage from "@/pages/dashboard/AnalyticsPage";
import BillingPage from "@/pages/dashboard/BillingPage";
import SettingsPage from "@/pages/dashboard/SettingsPage";
import ImportPage from "@/pages/dashboard/ImportPage";
import AdminOverview from "@/pages/admin/AdminOverview";
import TenantsPage from "@/pages/admin/TenantsPage";
import PlansPage from "@/pages/admin/PlansPage";
import CatalogHome from "@/pages/catalog/CatalogHome";
import ProductDetailPage from "@/pages/catalog/ProductDetailPage";
import CartPage from "@/pages/catalog/CartPage";
import CheckoutPage from "@/pages/catalog/CheckoutPage";

function ProtectedRoute({ 
  component: Component,
  requireSuperAdmin = false,
}: { 
  component: React.ComponentType;
  requireSuperAdmin?: boolean;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (requireSuperAdmin && user.role !== "superadmin") {
    return <Redirect to="/dashboard" />;
  }

  if (!requireSuperAdmin && user.role === "superadmin") {
    return <Redirect to="/admin" />;
  }

  return <Component />;
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  if (user) {
    if (user.role === "superadmin") {
      return <Redirect to="/admin" />;
    }
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      
      <Route path="/login">
        <PublicRoute component={LoginPage} />
      </Route>
      <Route path="/register">
        <PublicRoute component={RegisterPage} />
      </Route>

      <Route path="/dashboard">
        <ProtectedRoute component={DashboardOverview} />
      </Route>
      <Route path="/dashboard/products">
        <ProtectedRoute component={ProductsPage} />
      </Route>
      <Route path="/dashboard/products/new">
        <ProtectedRoute component={ProductFormPage} />
      </Route>
      <Route path="/dashboard/products/:id">
        <ProtectedRoute component={ProductFormPage} />
      </Route>
      <Route path="/dashboard/categories">
        <ProtectedRoute component={CategoriesPage} />
      </Route>
      <Route path="/dashboard/categories/new">
        <ProtectedRoute component={CategoriesPage} />
      </Route>
      <Route path="/dashboard/orders">
        <ProtectedRoute component={OrdersPage} />
      </Route>
      <Route path="/dashboard/orders/:id">
        <ProtectedRoute component={OrderDetailPage} />
      </Route>
      <Route path="/dashboard/discounts">
        <ProtectedRoute component={DiscountsPage} />
      </Route>
      <Route path="/dashboard/discounts/new">
        <ProtectedRoute component={DiscountsPage} />
      </Route>
      <Route path="/dashboard/analytics">
        <ProtectedRoute component={AnalyticsPage} />
      </Route>
      <Route path="/dashboard/billing">
        <ProtectedRoute component={BillingPage} />
      </Route>
      <Route path="/dashboard/settings">
        <ProtectedRoute component={SettingsPage} />
      </Route>
      <Route path="/dashboard/import">
        <ProtectedRoute component={ImportPage} />
      </Route>

      <Route path="/admin">
        <ProtectedRoute component={AdminOverview} requireSuperAdmin />
      </Route>
      <Route path="/admin/tenants">
        <ProtectedRoute component={TenantsPage} requireSuperAdmin />
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute component={TenantsPage} requireSuperAdmin />
      </Route>
      <Route path="/admin/plans">
        <ProtectedRoute component={PlansPage} requireSuperAdmin />
      </Route>
      <Route path="/admin/settings">
        <ProtectedRoute component={SettingsPage} requireSuperAdmin />
      </Route>

      <Route path="/c/:slug" component={CatalogHome} />
      <Route path="/c/:slug/cart" component={CartPage} />
      <Route path="/c/:slug/checkout" component={CheckoutPage} />
      <Route path="/c/:slug/product/:id" component={ProductDetailPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
