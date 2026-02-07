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
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import DashboardOverview from "@/pages/dashboard/DashboardOverview";
import ProductsPage from "@/pages/dashboard/ProductsPage";
import ProductFormPage from "@/pages/dashboard/ProductFormPage";
import CategoriesPage from "@/pages/dashboard/CategoriesPage";
import CRMPage from "@/pages/dashboard/CRMPage";
import OrderDetailPage from "@/pages/dashboard/OrderDetailPage";
import PaymentsPage from "@/pages/dashboard/PaymentsPage";
import DiscountsPage from "@/pages/dashboard/DiscountsPage";
import PromoZonePage from "@/pages/dashboard/PromoZonePage";
import AnalyticsPage from "@/pages/dashboard/AnalyticsPage";
import BillingPage from "@/pages/dashboard/BillingPage";
import SettingsPage from "@/pages/dashboard/SettingsPage";
import ImportPage from "@/pages/dashboard/ImportPage";
import CatalogHealthPage from "@/pages/dashboard/CatalogHealthPage";
import AdminOverview from "@/pages/admin/AdminOverview";
import UsersPage from "@/pages/admin/UsersPage";
import UsersFreePageRoute from "@/pages/admin/UsersFreePageRoute";
import LeadsPage from "@/pages/admin/LeadsPage";
import PlanRequestsPage from "@/pages/admin/PlanRequestsPage";
import PlansPage from "@/pages/admin/PlansPage";
import AiOverviewPage from "@/pages/dashboard/ai/AiOverviewPage";
import AiSalesScriptsPage from "@/pages/dashboard/ai/AiSalesScriptsPage";
import AiTagsPage from "@/pages/dashboard/ai/AiTagsPage";
import AiKnowledgePage from "@/pages/dashboard/ai/AiKnowledgePage";
import AiFaqPage from "@/pages/dashboard/ai/AiFaqPage";
import AiPoliciesPage from "@/pages/dashboard/ai/AiPoliciesPage";
import AiInboxPage from "@/pages/dashboard/ai/AiInboxPage";
import AiSandboxPage from "@/pages/dashboard/ai/AiSandboxPage";
import AiAnalyticsPage from "@/pages/dashboard/ai/AiAnalyticsPage";
import AiIntegrationsPage from "@/pages/dashboard/ai/AiIntegrationsPage";
import AiSettingsPage from "@/pages/dashboard/ai/AiSettingsPage";
import CatalogRouter from "@/pages/catalog/CatalogRouter";
import ProductDetailPage from "@/pages/catalog/ProductDetailPage";
import CartPage from "@/pages/catalog/CartPage";
import CheckoutPage from "@/pages/catalog/CheckoutPage";
import PromoPage from "@/pages/catalog/PromoPage";
import LinksPage from "@/pages/dashboard/LinksPage";
import LinksPublicPage from "@/pages/public/LinksPublicPage";
import IntegrationsPage from "@/pages/dashboard/IntegrationsPage";
import WhatsAppCloudPage from "@/pages/dashboard/WhatsAppCloudPage";
import SmartContactPage from "@/pages/dashboard/SmartContactPage";
import BusinessConsultantPage from "@/pages/dashboard/BusinessConsultantPage";
import TemplatesPage from "@/pages/dashboard/TemplatesPage";
import PrivacyPage from "@/pages/legal/PrivacyPage";
import PrivacyPageKz from "@/pages/legal/PrivacyPageKz";
import TermsPage from "@/pages/legal/TermsPage";
import TermsPageKz from "@/pages/legal/TermsPageKz";
import RefundPage from "@/pages/legal/RefundPage";
import RefundPageKz from "@/pages/legal/RefundPageKz";
import ContactsPage from "@/pages/legal/ContactsPage";

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
      
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/privacy-kz" component={PrivacyPageKz} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/terms-kz" component={TermsPageKz} />
      <Route path="/refund" component={RefundPage} />
      <Route path="/refund-kz" component={RefundPageKz} />
      <Route path="/contacts" component={ContactsPage} />
      
      <Route path="/login">
        <PublicRoute component={LoginPage} />
      </Route>
      <Route path="/register">
        <PublicRoute component={RegisterPage} />
      </Route>
      <Route path="/forgot-password">
        <PublicRoute component={ForgotPasswordPage} />
      </Route>
      <Route path="/reset-password">
        <PublicRoute component={ResetPasswordPage} />
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
      <Route path="/dashboard/crm">
        <ProtectedRoute component={CRMPage} />
      </Route>
      <Route path="/dashboard/crm/:id">
        <ProtectedRoute component={OrderDetailPage} />
      </Route>
      <Route path="/dashboard/orders">
        {() => <Redirect to="/dashboard/crm" />}
      </Route>
      <Route path="/dashboard/orders/:id">
        {(params) => <Redirect to={`/dashboard/crm/${params.id}`} />}
      </Route>
      <Route path="/dashboard/payments">
        <ProtectedRoute component={PaymentsPage} />
      </Route>
      <Route path="/dashboard/discounts">
        <ProtectedRoute component={DiscountsPage} />
      </Route>
      <Route path="/dashboard/discounts/new">
        <ProtectedRoute component={DiscountsPage} />
      </Route>
      <Route path="/dashboard/promo-zone">
        <ProtectedRoute component={PromoZonePage} />
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
      <Route path="/dashboard/templates">
        <ProtectedRoute component={TemplatesPage} />
      </Route>
      <Route path="/dashboard/import">
        <ProtectedRoute component={ImportPage} />
      </Route>
      <Route path="/dashboard/catalog-health">
        <ProtectedRoute component={CatalogHealthPage} />
      </Route>
      <Route path="/dashboard/integrations">
        <ProtectedRoute component={IntegrationsPage} />
      </Route>
      <Route path="/dashboard/whatsapp-cloud">
        <ProtectedRoute component={WhatsAppCloudPage} />
      </Route>
      <Route path="/dashboard/smart-contact">
        <ProtectedRoute component={SmartContactPage} />
      </Route>
      <Route path="/dashboard/consultant">
        <ProtectedRoute component={BusinessConsultantPage} />
      </Route>

      <Route path="/dashboard/ai">
        <ProtectedRoute component={AiOverviewPage} />
      </Route>
      <Route path="/dashboard/ai/scripts">
        <ProtectedRoute component={AiSalesScriptsPage} />
      </Route>
      <Route path="/dashboard/ai/tags">
        <ProtectedRoute component={AiTagsPage} />
      </Route>
      <Route path="/dashboard/ai/knowledge">
        <ProtectedRoute component={AiKnowledgePage} />
      </Route>
      <Route path="/dashboard/ai/faq">
        <ProtectedRoute component={AiFaqPage} />
      </Route>
      <Route path="/dashboard/ai/policies">
        <ProtectedRoute component={AiPoliciesPage} />
      </Route>
      <Route path="/dashboard/ai/inbox">
        <ProtectedRoute component={AiInboxPage} />
      </Route>
      <Route path="/dashboard/ai/sandbox">
        <ProtectedRoute component={AiSandboxPage} />
      </Route>
      <Route path="/dashboard/ai/analytics">
        <ProtectedRoute component={AiAnalyticsPage} />
      </Route>
      <Route path="/dashboard/ai/integrations">
        <ProtectedRoute component={AiIntegrationsPage} />
      </Route>
      <Route path="/dashboard/ai/settings">
        <ProtectedRoute component={AiSettingsPage} />
      </Route>

      <Route path="/admin">
        <ProtectedRoute component={AdminOverview} requireSuperAdmin />
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute component={UsersPage} requireSuperAdmin />
      </Route>
      <Route path="/admin/users-free">
        <ProtectedRoute component={UsersFreePageRoute} requireSuperAdmin />
      </Route>
      <Route path="/admin/leads">
        <ProtectedRoute component={LeadsPage} requireSuperAdmin />
      </Route>
      <Route path="/admin/plan-requests">
        <ProtectedRoute component={PlanRequestsPage} requireSuperAdmin />
      </Route>
      <Route path="/admin/plans">
        <ProtectedRoute component={PlansPage} requireSuperAdmin />
      </Route>
      <Route path="/admin/settings">
        <ProtectedRoute component={SettingsPage} requireSuperAdmin />
      </Route>

      <Route path="/dashboard/links">
        <ProtectedRoute component={LinksPage} />
      </Route>

      <Route path="/l/:slug" component={LinksPublicPage} />

      <Route path="/c/:slug" component={CatalogRouter} />
      <Route path="/c/:slug/cart" component={CartPage} />
      <Route path="/c/:slug/checkout" component={CheckoutPage} />
      <Route path="/c/:slug/product/:id" component={ProductDetailPage} />
      <Route path="/c/:slug/promo/:promoId" component={PromoPage} />

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
