import { Users, Building2, Calendar, AlertTriangle, TrendingUp, Activity } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth } from "date-fns";

const PIE_COLORS = [
  "hsl(150, 40%, 20%)",
  "hsl(30, 50%, 55%)",
  "hsl(25, 70%, 50%)",
  "hsl(140, 50%, 40%)",
  "hsl(40, 15%, 60%)",
  "hsl(200, 50%, 50%)",
  "hsl(280, 40%, 50%)",
];

const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(40, 25%, 99%)",
    border: "1px solid hsl(40, 15%, 87%)",
    borderRadius: "0.625rem",
    fontSize: "0.8rem",
  },
};

export default function Dashboard() {
  // Stats queries
  const { data: totalUsers = 0, isLoading: loadingUsers } = useQuery({
    queryKey: ["stats-users"],
    queryFn: async () => {
      const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: totalOrganizers = 0, isLoading: loadingOrgs } = useQuery({
    queryKey: ["stats-organizers"],
    queryFn: async () => {
      const { count } = await supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "organizer");
      return count || 0;
    },
  });

  const { data: totalEvents = 0, isLoading: loadingEvents } = useQuery({
    queryKey: ["stats-events"],
    queryFn: async () => {
      const { count } = await supabase.from("events").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: openIssues = 0, isLoading: loadingIssues } = useQuery({
    queryKey: ["stats-issues"],
    queryFn: async () => {
      const { count } = await supabase.from("issues").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress"]);
      return count || 0;
    },
  });

  // Category distribution for pie chart
  const { data: categoryData = [] } = useQuery({
    queryKey: ["stats-categories"],
    queryFn: async () => {
      const { data: categories } = await supabase.from("event_categories").select("id, name");
      const { data: events } = await supabase.from("events").select("category_id");
      if (!categories) return [];
      return categories.map((cat) => ({
        name: cat.name,
        value: events?.filter((e) => e.category_id === cat.id).length || 0,
      })).filter((c) => c.value > 0);
    },
  });

  // Events by month
  const { data: eventsByMonth = [] } = useQuery({
    queryKey: ["stats-events-month"],
    queryFn: async () => {
      const { data: events } = await supabase.from("events").select("date, id");
      const { data: regs } = await supabase.from("event_registrations").select("created_at");
      const months: { month: string; events: number; registrations: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const label = format(d, "MMM");
        const start = format(startOfMonth(d), "yyyy-MM-dd");
        const end = format(startOfMonth(subMonths(d, -1)), "yyyy-MM-dd");
        months.push({
          month: label,
          events: events?.filter((e) => e.date >= start && e.date < end).length || 0,
          registrations: regs?.filter((r) => r.created_at >= start && r.created_at < end).length || 0,
        });
      }
      return months;
    },
  });

  // Issues trend
  const { data: issuesTrend = [] } = useQuery({
    queryKey: ["stats-issues-trend"],
    queryFn: async () => {
      const { data: issues } = await supabase.from("issues").select("created_at, status, resolved_at");
      const weeks: { week: string; opened: number; resolved: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const start = new Date();
        start.setDate(start.getDate() - (i + 1) * 7);
        const end = new Date();
        end.setDate(end.getDate() - i * 7);
        weeks.push({
          week: `W${6 - i}`,
          opened: issues?.filter((is) => new Date(is.created_at) >= start && new Date(is.created_at) < end).length || 0,
          resolved: issues?.filter((is) => is.resolved_at && new Date(is.resolved_at) >= start && new Date(is.resolved_at) < end).length || 0,
        });
      }
      return weeks;
    },
  });

  // Recent activity
  const { data: recentActivity = [] } = useQuery({
    queryKey: ["stats-recent"],
    queryFn: async () => {
      const activities: { action: string; detail: string; time: string; type: string }[] = [];
      
      const { data: recentUsers } = await supabase.from("profiles").select("first_name, last_name, created_at").order("created_at", { ascending: false }).limit(3);
      recentUsers?.forEach((u) => activities.push({ action: "New user registered", detail: `${u.first_name} ${u.last_name}`, time: u.created_at, type: "user" }));

      const { data: recentEvents } = await supabase.from("events").select("title, created_at").order("created_at", { ascending: false }).limit(3);
      recentEvents?.forEach((e) => activities.push({ action: "Event created", detail: e.title, time: e.created_at, type: "event" }));

      const { data: recentIssues } = await supabase.from("issues").select("title, created_at").order("created_at", { ascending: false }).limit(3);
      recentIssues?.forEach((is) => activities.push({ action: "Issue reported", detail: is.title, time: is.created_at, type: "issue" }));

      return activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6);
    },
  });

  const typeColors: Record<string, string> = {
    user: "bg-primary/10 text-primary",
    event: "bg-secondary/20 text-secondary",
    issue: "bg-destructive/10 text-destructive",
    organizer: "bg-accent/20 text-accent",
  };

  const isLoading = loadingUsers || loadingOrgs || loadingEvents || loadingIssues;

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back, Super Admin</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard title="Total Users" value={totalUsers.toLocaleString()} icon={Users} />
            <StatCard title="Organizers" value={totalOrganizers.toLocaleString()} icon={Building2} />
            <StatCard title="Total Events" value={totalEvents.toLocaleString()} icon={Calendar} />
            <StatCard title="Open Issues" value={openIssues.toLocaleString()} icon={AlertTriangle} changeType={openIssues > 0 ? "negative" : "positive"} change={openIssues === 0 ? "All clear" : `${openIssues} need attention`} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-accent" />
              Events & Registrations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={eventsByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 87%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(150, 10%, 45%)" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(150, 10%, 45%)" }} />
                <Tooltip {...chartTooltipStyle} />
                <Legend />
                <Bar dataKey="events" fill="hsl(150, 40%, 20%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="registrations" fill="hsl(30, 50%, 55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Category Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            {categoryData.length === 0 ? (
              <p className="text-muted-foreground text-sm py-16">No events with categories yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Issues Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={issuesTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 87%)" />
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: "hsl(150, 10%, 45%)" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(150, 10%, 45%)" }} />
                <Tooltip {...chartTooltipStyle} />
                <Legend />
                <Line type="monotone" dataKey="opened" stroke="hsl(0, 65%, 50%)" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="resolved" stroke="hsl(140, 50%, 40%)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-accent" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No recent activity</p>
              ) : (
                recentActivity.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${typeColors[item.type] || ""}`}>{item.type}</Badge>
                      <div>
                        <p className="text-xs font-medium">{item.action}</p>
                        <p className="text-[10px] text-muted-foreground">{item.detail}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(item.time)}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
