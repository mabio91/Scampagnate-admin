import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/organizers" element={<OrganizersPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/issues" element={<IssuesPage />} />
            <Route path="/equipment-templates" element={<EquipmentTemplatesPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
