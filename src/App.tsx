import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AdminLayout } from "@/components/AdminLayout";
import { AuthGuard } from "@/components/AuthGuard";
import Dashboard from "@/pages/Dashboard";
import UsersPage from "@/pages/UsersPage";
import OrganizersPage from "@/pages/OrganizersPage";
import CategoriesPage from "@/pages/CategoriesPage";
import EventsPage from "@/pages/EventsPage";
import IssuesPage from "@/pages/IssuesPage";
import EquipmentTemplatesPage from "@/pages/EquipmentTemplatesPage";
import ProfilePage from "@/pages/ProfilePage";
import MembersPage from "@/pages/MembersPage";
import ProposalsPage from "@/pages/ProposalsPage";
import DiscountCodesPage from "@/pages/DiscountCodesPage";
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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/organizers" element={<OrganizersPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/equipment-templates" element={<EquipmentTemplatesPage />} />
            <Route path="/issues" element={<IssuesPage />} />
            <Route path="/members" element={<MembersPage />} />
            <Route path="/proposals" element={<ProposalsPage />} />
            <Route path="/discount-codes" element={<DiscountCodesPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
