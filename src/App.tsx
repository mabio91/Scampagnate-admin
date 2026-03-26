import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AdminLayout } from "@/components/AdminLayout";
import { AuthGuard } from "@/components/AuthGuard";
import Dashboard from "@/pages/Dashboard";
import UsersPage from "@/pages/UsersPage";
import UserDetailPage from "@/pages/UserDetailPage";
import OrganizersPage from "@/pages/OrganizersPage";
import OrganizerDetailPage from "@/pages/OrganizerDetailPage";
import CategoriesPage from "@/pages/CategoriesPage";
import EventsPage from "@/pages/EventsPage";
import EventDetailPage from "@/pages/EventDetailPage";
import IssuesPage from "@/pages/IssuesPage";
import EquipmentTemplatesPage from "@/pages/EquipmentTemplatesPage";
import ProfilePage from "@/pages/ProfilePage";
import MembersPage from "@/pages/MembersPage";
import ProposalsPage from "@/pages/ProposalsPage";
import DiscountCodesPage from "@/pages/DiscountCodesPage";
import MerchPage from "@/pages/MerchPage";
import ContentPagesPage from "@/pages/ContentPagesPage";
import ContentPageView from "@/pages/ContentPageView";
import MissionsPage from "@/pages/MissionsPage";
import GamificationSettingsPage from "@/pages/GamificationSettingsPage";
import KPIDetailPage from "@/pages/KPIDetailPage";
import LoginPage from "@/pages/LoginPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedLayout() {
  return (
    <AuthGuard>
      <AdminLayout />
    </AuthGuard>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/page/:slug" element={<ContentPageView />} />
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/users/:id" element={<UserDetailPage />} />
              <Route path="/organizers" element={<OrganizersPage />} />
              <Route path="/organizers/:id" element={<OrganizerDetailPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/events/:id" element={<EventDetailPage />} />
              <Route path="/equipment-templates" element={<EquipmentTemplatesPage />} />
              <Route path="/issues" element={<IssuesPage />} />
              <Route path="/members" element={<MembersPage />} />
              <Route path="/proposals" element={<ProposalsPage />} />
              <Route path="/discount-codes" element={<DiscountCodesPage />} />
              <Route path="/merch" element={<MerchPage />} />
              <Route path="/content-pages" element={<ContentPagesPage />} />
              <Route path="/missions" element={<MissionsPage />} />
              <Route path="/gamification-settings" element={<GamificationSettingsPage />} />
              <Route path="/kpi" element={<KPIDetailPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </LanguageProvider>
  </ThemeProvider>
);

export default App;
