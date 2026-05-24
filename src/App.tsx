import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AdminLayout } from "@/components/AdminLayout";
import { AuthGuard } from "@/components/AuthGuard";

const queryClient = new QueryClient();

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const UsersPage = lazy(() => import("@/pages/UsersPage"));
const UserDetailPage = lazy(() => import("@/pages/UserDetailPage"));
const OrganizersPage = lazy(() => import("@/pages/OrganizersPage"));
const OrganizerDetailPage = lazy(() => import("@/pages/OrganizerDetailPage"));
const CategoriesPage = lazy(() => import("@/pages/CategoriesPage"));
const EventsPage = lazy(() => import("@/pages/EventsPage"));
const EventDetailPage = lazy(() => import("@/pages/EventDetailPage"));
const IssuesPage = lazy(() => import("@/pages/IssuesPage"));
const EquipmentTemplatesPage = lazy(() => import("@/pages/EquipmentTemplatesPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const MembersPage = lazy(() => import("@/pages/MembersPage"));
const ProposalsPage = lazy(() => import("@/pages/ProposalsPage"));
const DiscountCodesPage = lazy(() => import("@/pages/DiscountCodesPage"));
const MerchPage = lazy(() => import("@/pages/MerchPage"));
const ContentPagesPage = lazy(() => import("@/pages/ContentPagesPage"));
const ContentPageView = lazy(() => import("@/pages/ContentPageView"));
const EventClosingSentencesPage = lazy(() => import("@/pages/EventClosingSentencesPage"));
const MissionsPage = lazy(() => import("@/pages/MissionsPage"));
const GamificationSettingsPage = lazy(() => import("@/pages/GamificationSettingsPage"));
const RewardsAdminPage = lazy(() => import("@/pages/RewardsAdminPage"));
const TrekkingDifficultyPage = lazy(() => import("@/pages/TrekkingDifficultyPage"));
const EmailTemplatesPage = lazy(() => import("@/pages/EmailTemplatesPage"));
const PushBroadcastsPage = lazy(() => import("@/pages/PushBroadcastsPage"));
const KPIDetailPage = lazy(() => import("@/pages/KPIDetailPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const PageFallback = () => (
  <div className="min-h-screen bg-background" />
);

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
          <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
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
                <Route path="/event-closing-sentences" element={<EventClosingSentencesPage />} />
                <Route path="/missions" element={<MissionsPage />} />
                <Route path="/gamification-settings" element={<GamificationSettingsPage />} />
                <Route path="/rewards" element={<RewardsAdminPage />} />
                <Route path="/trekking-difficulty" element={<TrekkingDifficultyPage />} />
                <Route path="/email-templates" element={<EmailTemplatesPage />} />
                <Route path="/push-broadcasts" element={<PushBroadcastsPage />} />
                <Route path="/kpi" element={<KPIDetailPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </LanguageProvider>
  </ThemeProvider>
);

export default App;
