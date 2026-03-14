import { useState, useEffect } from "react";
import { Users, Building2, Calendar, AlertTriangle, Activity, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

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
    borderRadius: "0.75rem",
    fontSize: "0.8rem",
    boxShadow: "0 8px 32px -8px rgba(0,0,0,0.12)",
    padding: "10px 14px",
  },
};

/* ── Premium Stat Card ── */
interface PremiumStatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  gradient: string;
  iconBg: string;
}

function PremiumStatCard({ title, value, icon: Icon, change, changeType = "neutral", gradient, iconBg }: PremiumStatCardProps) {
  const ChangeIcon = changeType === "positive" ? ArrowUpRight : changeType === "negative" ? ArrowDownRight : Minus;
  return (
    <Card className={cn(
      "relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5",
      gradient
    )}>
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-[0.07] -translate-y-8 translate-x-8 bg-foreground" />
      <CardContent className="p-5 relative z-10">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">{title}</p>
            <p className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Source Sans 3', sans-serif" }}>{value}</p>
            {change && (
              <div className={cn(
                "flex items-center gap-1 text-xs font-medium mt-1.5",
                changeType === "positive" ? "text-success" : changeType === "negative" ? "text-destructive" : "text-muted-foreground"
              )}>
                <ChangeIcon className="h-3.5 w-3.5" />
                <span>{change}</span>
              </div>
            )}
          </div>
          <div className={cn("p-3 rounded-xl shadow-sm", iconBg)}>
            <Icon className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Chart Card Wrapper ── */
function ChartCard({ title, icon: Icon, children, className }: { title: string; icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2.5 text-base font-semibold" style={{ fontFamily: "'Source Sans 3', sans-serif" }}>
          {Icon && (
            <div className="p-1.5 rounded-lg bg-accent/10">
              <Icon className="h-4 w-4 text-accent" />
            </div>
          )}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

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

  const typeConfig: Record<string, { bg: string; dot: string }> = {
    user: { bg: "bg-primary/8 text-primary border-primary/20", dot: "bg-primary" },
    event: { bg: "bg-accent/8 text-accent border-accent/20", dot: "bg-accent" },
    issue: { bg: "bg-destructive/8 text-destructive border-destructive/20", dot: "bg-destructive" },
    organizer: { bg: "bg-secondary/8 text-secondary border-secondary/20", dot: "bg-secondary" },
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase">Overview</p>
          <h1 className="text-3xl font-bold mt-1">Dashboard</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {format(now, "EEEE, MMMM d, yyyy · h:mm a")}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))
        ) : (
          <>
            <PremiumStatCard
              title="Total Users"
              value={totalUsers.toLocaleString()}
              icon={Users}
              gradient="bg-card"
              iconBg="bg-primary"
            />
            <PremiumStatCard
              title="Organizers"
              value={totalOrganizers.toLocaleString()}
              icon={Building2}
              gradient="bg-card"
              iconBg="bg-secondary"
            />
            <PremiumStatCard
              title="Total Events"
              value={totalEvents.toLocaleString()}
              icon={Calendar}
              gradient="bg-card"
              iconBg="bg-accent"
            />
            <PremiumStatCard
              title="Open Issues"
              value={openIssues.toLocaleString()}
              icon={AlertTriangle}
              changeType={openIssues > 0 ? "negative" : "positive"}
              change={openIssues === 0 ? "All clear" : `${openIssues} need attention`}
              gradient="bg-card"
              iconBg="bg-destructive"
            />
          </>
        )}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Events & Registrations" icon={Calendar} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={eventsByMonth} barGap={4}>
              <defs>
                <linearGradient id="barEvents" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(150, 40%, 25%)" stopOpacity={1} />
                  <stop offset="100%" stopColor="hsl(150, 40%, 20%)" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="barRegs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(30, 50%, 60%)" stopOpacity={1} />
                  <stop offset="100%" stopColor="hsl(30, 50%, 55%)" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 90%)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(150, 10%, 45%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(150, 10%, 45%)" }} axisLine={false} tickLine={false} />
              <Tooltip {...chartTooltipStyle} cursor={{ fill: "hsl(40, 15%, 94%)" }} />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
              <Bar dataKey="events" fill="url(#barEvents)" radius={[6, 6, 0, 0]} maxBarSize={32} />
              <Bar dataKey="registrations" fill="url(#barRegs)" radius={[6, 6, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Category Distribution">
          {categoryData.length === 0 ? (
            <div className="flex items-center justify-center h-[280px]">
              <p className="text-muted-foreground text-sm">No events with categories yet</p>
            </div>
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                    strokeWidth={0}
                    label={({ percent, cx: cxPos, cy: cyPos, midAngle, outerRadius: oR }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = oR + 18;
                      const x = cxPos + radius * Math.cos(-midAngle * RADIAN);
                      const y = cyPos + radius * Math.sin(-midAngle * RADIAN);
                      return (
                        <text
                          x={x}
                          y={y}
                          textAnchor={x > cxPos ? "start" : "end"}
                          dominantBaseline="central"
                          fill="hsl(150, 10%, 35%)"
                          fontSize={11}
                          fontWeight={600}
                        >
                          {`${(percent * 100).toFixed(0)}%`}
                        </text>
                      );
                    }}
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2 px-2">
                {categoryData.map((entry, i) => {
                  const total = categoryData.reduce((sum, d) => sum + d.value, 0);
                  const pct = total > 0 ? ((entry.value / total) * 100).toFixed(0) : "0";
                  return (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="truncate max-w-[120px]">{entry.name}</span>
                      <span className="font-semibold text-foreground">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Issues Trend">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={issuesTrend}>
              <defs>
                <linearGradient id="lineOpened" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(0, 65%, 50%)" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="hsl(0, 65%, 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 90%)" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 12, fill: "hsl(150, 10%, 45%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(150, 10%, 45%)" }} axisLine={false} tickLine={false} />
              <Tooltip {...chartTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
              <Line type="monotone" dataKey="opened" stroke="hsl(0, 65%, 50%)" strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2, fill: "hsl(40, 25%, 99%)" }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="resolved" stroke="hsl(140, 50%, 40%)" strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2, fill: "hsl(40, 25%, 99%)" }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Recent Activity" icon={Activity} className="lg:col-span-2">
          <div className="space-y-1">
            {recentActivity.length === 0 ? (
              <div className="flex items-center justify-center h-[240px]">
                <p className="text-sm text-muted-foreground">No recent activity</p>
              </div>
            ) : (
              recentActivity.map((item, i) => {
                const config = typeConfig[item.type] || typeConfig.user;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("h-2 w-2 rounded-full shrink-0", config.dot)} />
                      <div>
                        <p className="text-sm font-medium group-hover:text-foreground transition-colors">{item.action}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={cn("text-[10px] font-medium border", config.bg)}>
                        {item.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">{timeAgo(item.time)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
