import { Users, Building2, Tags, Calendar, AlertTriangle, LayoutDashboard, Shield, IdCard, Package, User, LogOut, Lightbulb, TicketPercent, ShoppingBag, FileText, Target, Settings2, Mountain } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems: { titleKey: TranslationKey; url: string; icon: any }[] = [
  { titleKey: "sidebar.dashboard", url: "/", icon: LayoutDashboard },
  { titleKey: "sidebar.users", url: "/users", icon: Users },
  { titleKey: "sidebar.members", url: "/members", icon: IdCard },
  { titleKey: "sidebar.organizers", url: "/organizers", icon: Building2 },
  { titleKey: "sidebar.eventCategories", url: "/categories", icon: Tags },
  { titleKey: "sidebar.events", url: "/events", icon: Calendar },
  { titleKey: "sidebar.equipmentTemplates", url: "/equipment-templates", icon: Package },
  { titleKey: "sidebar.issues", url: "/issues", icon: AlertTriangle },
  { titleKey: "sidebar.proposals", url: "/proposals", icon: Lightbulb },
  { titleKey: "sidebar.discountCodes", url: "/discount-codes", icon: TicketPercent },
  { titleKey: "sidebar.merch", url: "/merch", icon: ShoppingBag },
  { titleKey: "sidebar.contentPages", url: "/content-pages", icon: FileText },
  { titleKey: "sidebar.missions", url: "/missions", icon: Target },
  { titleKey: "sidebar.gamificationSettings", url: "/gamification-settings", icon: Settings2 },
  { titleKey: "sidebar.trekkingDifficulty", url: "/trekking-difficulty", icon: Mountain },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Gruppo Scampagnate" className="w-10 h-10 rounded-full" />
          {!collapsed && (
            <div>
              <h2 className="text-sm font-bold text-sidebar-foreground font-sans">{t("sidebar.superAdmin")}</h2>
              <p className="text-xs text-sidebar-accent-foreground/60">Gruppo Scampagnate</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-accent-foreground/50 uppercase text-[10px] tracking-widest">
            {t("sidebar.management")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{t(item.titleKey)}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/profile"
                className="hover:bg-sidebar-accent"
                activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
              >
                <User className="mr-2 h-4 w-4" />
                {!collapsed && <span>{t("sidebar.myProfile")}</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="hover:bg-destructive/10 text-destructive cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {!collapsed && <span>{t("sidebar.logout")}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
