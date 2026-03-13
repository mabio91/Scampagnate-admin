import { Users, Building2, Tags, Calendar, AlertTriangle, LayoutDashboard, Shield, IdCard } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import logo from "@/assets/logo.png";

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

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Users", url: "/users", icon: Users },
  { title: "Members", url: "/members", icon: IdCard },
  { title: "Organizers", url: "/organizers", icon: Building2 },
  { title: "Event Categories", url: "/categories", icon: Tags },
  { title: "Events", url: "/events", icon: Calendar },
  { title: "Issues", url: "/issues", icon: AlertTriangle },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Gruppo Scampagnate" className="w-10 h-10 rounded-full" />
          {!collapsed && (
            <div>
              <h2 className="text-sm font-bold text-sidebar-foreground font-sans">Super Admin</h2>
              <p className="text-xs text-sidebar-accent-foreground/60">Gruppo Scampagnate</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-accent-foreground/50 uppercase text-[10px] tracking-widest">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!collapsed && (
          <div className="flex items-center gap-2 text-sidebar-accent-foreground/60 text-xs">
            <Shield className="h-3.5 w-3.5" />
            <span>Admin v1.0</span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
