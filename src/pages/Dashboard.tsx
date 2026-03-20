import { useState, useEffect, useMemo } from "react";
import { useTheme } from "next-themes";
import {
  Users, Building2, Calendar, AlertTriangle, Activity, ArrowUpRight, ArrowDownRight, Minus,
  TrendingUp, UserCheck, BarChart3, Clock, Repeat, UserPlus, Star, CloudSun, MapPin,
  CheckCircle2, ListChecks, Percent, Trophy
} from "lucide-react";
import RefreshButton from "@/components/RefreshButton";
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
import { useLanguage } from "@/i18n/LanguageContext";

const PIE_COLORS = [
  "hsl(150, 40%, 20%)",
  "hsl(30, 50%, 55%)",
  "hsl(25, 70%, 50%)",
  "hsl(140, 50%, 40%)",
  "hsl(40, 15%, 60%)",
  "hsl(200, 50%, 50%)",
  "hsl(280, 40%, 50%)",
];

function useChartTheme() {
  const { theme, resolvedTheme } = useTheme();
  const [, setTick] = useState(0);

  // Re-compute when theme changes (CSS vars update async)
  useEffect(() => {
    const timer = setTimeout(() => setTick((t) => t + 1), 50);
    return () => clearTimeout(timer);
  }, [theme, resolvedTheme]);

  const getVar = (name: string) => {
    const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return val ? `hsl(${val})` : undefined;
  };
  return {
    tooltipStyle: {
      contentStyle: {
        backgroundColor: getVar("--popover") || "hsl(40, 25%, 99%)",
        border: `1px solid ${getVar("--border") || "hsl(40, 15%, 87%)"}`,
        borderRadius: "0.75rem",
        fontSize: "0.8rem",
        boxShadow: "0 8px 32px -8px rgba(0,0,0,0.12)",
        padding: "10px 14px",
        color: getVar("--popover-foreground") || "inherit",
      },
    },
    gridStroke: getVar("--border") || "hsl(40, 15%, 90%)",
    tickFill: getVar("--muted-foreground") || "hsl(150, 10%, 45%)",
    cursorFill: getVar("--muted") || "hsl(40, 15%, 94%)",
    dotFill: getVar("--card") || "hsl(40, 25%, 99%)",
    pieLabelFill: getVar("--muted-foreground") || "hsl(150, 10%, 35%)",
  };
}

/* ── Premium Stat Card ── */
interface PremiumStatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  gradient?: string;
  iconBg: string;
  subtitle?: string;
}

function PremiumStatCard({ title, value, icon: Icon, change, changeType = "neutral", iconBg, subtitle }: PremiumStatCardProps) {
  const ChangeIcon = changeType === "positive" ? ArrowUpRight : changeType === "negative" ? ArrowDownRight : Minus;
  return (
    <div className="relative rounded-xl bg-card border border-border/60 p-5 overflow-hidden">
      {/* Colored top bar */}
      <div className={cn("absolute top-0 left-0 right-0 h-1 rounded-t-xl", iconBg)} />
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0 flex-1 pt-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 truncate">{title}</p>
          <p className="text-2xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'Source Sans 3', sans-serif" }}>{value}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground/60 truncate leading-tight">{subtitle}</p>}
          {change && (
            <div className={cn(
              "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full mt-0.5",
              changeType === "positive" ? "text-success bg-success/10" : changeType === "negative" ? "text-destructive bg-destructive/10" : "text-muted-foreground bg-muted"
            )}>
              <ChangeIcon className="h-3 w-3" />
              <span>{change}</span>
            </div>
          )}
        </div>
        <div className={cn("p-2.5 rounded-xl shrink-0 mt-1", iconBg)}>
          <Icon className="h-[18px] w-[18px] text-primary-foreground" />
        </div>
      </div>
    </div>
  );
}

/* ── Chart Card Wrapper ── */
function ChartCard({ title, icon: Icon, children, className }: { title: string; icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl bg-card border border-border/60 overflow-hidden", className)}>
      <div className="flex items-center gap-2.5 px-6 pt-5 pb-3">
        {Icon && (
          <div className="p-1.5 rounded-lg bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <h3 className="text-sm font-semibold text-foreground tracking-tight" style={{ fontFamily: "'Source Sans 3', sans-serif" }}>{title}</h3>
      </div>
      <div className="px-6 pb-5">{children}</div>
    </div>
  );
}

/* ── Italy Time Hook ── */
function useItalyTime() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const italyTime = now.toLocaleString("en-US", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const italyDate = now.toLocaleString("en-US", {
    timeZone: "Europe/Rome",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return { italyTime, italyDate };
}

/* ── Weather Hook (Open-Meteo, no API key needed) ── */
function useItalyWeather() {
  return useQuery({
    queryKey: ["italy-weather"],
    queryFn: async () => {
      // Rome coordinates
      const res = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=41.9028&longitude=12.4964&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&timezone=Europe/Rome"
      );
      if (!res.ok) throw new Error("Weather fetch failed");
      const data = await res.json();
      return {
        temperature: Math.round(data.current.temperature_2m),
        weatherCode: data.current.weather_code as number,
        windSpeed: Math.round(data.current.wind_speed_10m),
        humidity: data.current.relative_humidity_2m,
      };
    },
    refetchInterval: 600000, // 10 min
    staleTime: 300000,
  });
}

function getWeatherLabel(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 65) return "Rainy";
  if (code <= 77) return "Snowy";
  if (code <= 82) return "Showers";
  if (code <= 99) return "Thunderstorm";
  return "Unknown";
}

export default function Dashboard() {
  const { italyTime, italyDate } = useItalyTime();
  const { data: weather } = useItalyWeather();
  const chartTheme = useChartTheme();
  const { t } = useLanguage();

  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;

  // ── PRIMARY KPIs ──

  const { data: totalUsers = 0, isLoading: l1 } = useQuery({
    queryKey: ["kpi-total-users"],
    queryFn: async () => {
      const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: activeMembers = 0, isLoading: l2 } = useQuery({
    queryKey: ["kpi-active-members"],
    queryFn: async () => {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("membership_status", "Active")
        .eq("membership_year", currentYear);
      return count || 0;
    },
  });

  const { data: usersAttended = 0, isLoading: l3 } = useQuery({
    queryKey: ["kpi-users-attended"],
    queryFn: async () => {
      const { data } = await supabase
        .from("event_registrations")
        .select("user_id, events!inner(date)")
        .eq("checked_in", true)
        .gte("events.date", yearStart);
      if (!data) return 0;
      const uniqueUsers = new Set(data.map((r: any) => r.user_id));
      return uniqueUsers.size;
    },
  });

  const { data: eventsThisYear = 0, isLoading: l4 } = useQuery({
    queryKey: ["kpi-events-year"],
    queryFn: async () => {
      const { count } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .gte("date", yearStart);
      return count || 0;
    },
  });

  const { data: participationRate = "0%", isLoading: l5 } = useQuery({
    queryKey: ["kpi-participation-rate", totalUsers],
    queryFn: async () => {
      const { data } = await supabase
        .from("event_registrations")
        .select("user_id")
        .in("status", ["registered", "paid", "attended"]);
      if (!data || totalUsers === 0) return "0%";
      const uniqueUsers = new Set(data.map((r) => r.user_id));
      return `${Math.round((uniqueUsers.size / totalUsers) * 100)}%`;
    },
    enabled: totalUsers > 0,
  });

  const { data: attendanceRate = "0%", isLoading: l6 } = useQuery({
    queryKey: ["kpi-attendance-rate"],
    queryFn: async () => {
      const { count: totalRegs } = await supabase
        .from("event_registrations")
        .select("*", { count: "exact", head: true })
        .in("status", ["registered", "paid", "attended"]);
      const { count: checkedIn } = await supabase
        .from("event_registrations")
        .select("*", { count: "exact", head: true })
        .eq("checked_in", true);
      if (!totalRegs || totalRegs === 0) return "0%";
      return `${Math.round(((checkedIn || 0) / totalRegs) * 100)}%`;
    },
  });

  // ── SECONDARY KPIs ──

  const { data: avgFillRate = "0%" } = useQuery({
    queryKey: ["kpi-fill-rate"],
    queryFn: async () => {
      const { data: events } = await supabase
        .from("events")
        .select("spots_taken, spots_total")
        .gt("spots_total", 0);
      if (!events || events.length === 0) return "0%";
      const avgRate = events.reduce((sum, e) => sum + (e.spots_taken / e.spots_total), 0) / events.length;
      return `${Math.round(avgRate * 100)}%`;
    },
  });

  const { data: totalWaitlist = 0 } = useQuery({
    queryKey: ["kpi-waitlist"],
    queryFn: async () => {
      const { count } = await supabase
        .from("event_registrations")
        .select("*", { count: "exact", head: true })
        .eq("status", "waitlist");
      return count || 0;
    },
  });

  const { data: repeatParticipants = 0 } = useQuery({
    queryKey: ["kpi-repeat"],
    queryFn: async () => {
      const { data } = await supabase
        .from("event_registrations")
        .select("user_id")
        .eq("checked_in", true);
      if (!data) return 0;
      const counts: Record<string, number> = {};
      data.forEach((r) => { counts[r.user_id] = (counts[r.user_id] || 0) + 1; });
      return Object.values(counts).filter((c) => c > 3).length;
    },
  });

  const { data: newUsersMonth = 0 } = useQuery({
    queryKey: ["kpi-new-users-month"],
    queryFn: async () => {
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", monthStart);
      return count || 0;
    },
  });

  const { data: topCategory = "N/A" } = useQuery({
    queryKey: ["kpi-top-category"],
    queryFn: async () => {
      const { data: events } = await supabase.from("events").select("category_id");
      const { data: cats } = await supabase.from("event_categories").select("id, name");
      if (!events || !cats || events.length === 0) return "N/A";
      const counts: Record<string, number> = {};
      events.forEach((e) => { if (e.category_id) counts[e.category_id] = (counts[e.category_id] || 0) + 1; });
      const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
      return cats.find((c) => c.id === topId)?.name || "N/A";
    },
  });

  // ── EXISTING CHART DATA ──

  const { data: openIssues = 0 } = useQuery({
    queryKey: ["stats-issues"],
    queryFn: async () => {
      const { count } = await supabase.from("issues").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress"]);
      return count || 0;
    },
  });

  const { data: totalOrganizers = 0 } = useQuery({
    queryKey: ["stats-organizers"],
    queryFn: async () => {
      const { count } = await supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "organizer");
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
        const start = new Date(); start.setDate(start.getDate() - (i + 1) * 7);
        const end = new Date(); end.setDate(end.getDate() - i * 7);
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
      recentUsers?.forEach((u) => activities.push({ action: "new_user", detail: `${u.first_name} ${u.last_name}`, time: u.created_at, type: "user" }));
      const { data: recentEvents } = await supabase.from("events").select("title, created_at").order("created_at", { ascending: false }).limit(3);
      recentEvents?.forEach((e) => activities.push({ action: "event_created", detail: e.title, time: e.created_at, type: "event" }));
      const { data: recentIssues } = await supabase.from("issues").select("title, created_at").order("created_at", { ascending: false }).limit(3);
      recentIssues?.forEach((is) => activities.push({ action: "issue_reported", detail: is.title, time: is.created_at, type: "issue" }));
      return activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6);
    },
  });

  const typeConfig: Record<string, { bg: string; dot: string }> = {
    user: { bg: "bg-primary/8 text-primary border-primary/20", dot: "bg-primary" },
    event: { bg: "bg-accent/8 text-accent border-accent/20", dot: "bg-accent" },
    issue: { bg: "bg-destructive/8 text-destructive border-destructive/20", dot: "bg-destructive" },
    organizer: { bg: "bg-secondary/8 text-secondary border-secondary/20", dot: "bg-secondary" },
  };

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6;

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* ── Header with Italy Time & Weather ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase">{t("header.superAdmin")}</p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{t("dashboard.title")}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <RefreshButton queryKeys={[["kpi-total-users"], ["kpi-active-members"], ["kpi-users-attended"], ["kpi-events-year"], ["kpi-participation-rate"], ["kpi-attendance-rate"], ["stats-issues"], ["stats-organizers"], ["stats-categories"], ["stats-events-month"], ["stats-issues-trend"], ["stats-recent"]]} />
          {/* Italy Time */}
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5 shadow-sm">
            <MapPin className="h-4 w-4 text-accent" />
            <div className="text-right">
              <p className="text-lg font-bold tabular-nums leading-tight" style={{ fontFamily: "'Source Sans 3', sans-serif" }}>
                {italyTime}
              </p>
              <p className="text-[10px] text-muted-foreground font-medium">
                🇮🇹 Italy · {italyDate}
              </p>
            </div>
          </div>
          {/* Weather */}
          {weather && (
            <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5 shadow-sm">
              <CloudSun className="h-4 w-4 text-secondary" />
              <div className="text-right">
                <p className="text-lg font-bold leading-tight" style={{ fontFamily: "'Source Sans 3', sans-serif" }}>
                  {weather.temperature}°C
                </p>
                <p className="text-[10px] text-muted-foreground font-medium">
                  {getWeatherLabel(weather.weatherCode)} · 💧{weather.humidity}% · 💨{weather.windSpeed} km/h
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── PRIMARY KPI Cards ── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">{t("dashboard.primaryMetrics")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
          ) : (
            <>
              <PremiumStatCard
                title={t("dashboard.totalUsers")}
                value={totalUsers.toLocaleString()}
                icon={Users}
                iconBg="bg-primary"
              />
              <PremiumStatCard
                title={t("dashboard.activeMembers")}
                value={activeMembers.toLocaleString()}
                icon={UserCheck}
                iconBg="bg-success"
                subtitle={`${t("dashboard.paidMembership")} ${currentYear}`}
              />
              <PremiumStatCard
                title={t("dashboard.usersAttended")}
                value={usersAttended.toLocaleString()}
                icon={CheckCircle2}
                iconBg="bg-secondary"
                subtitle={`${t("dashboard.atLeast1Event")} ${currentYear}`}
              />
              <PremiumStatCard
                title={t("dashboard.eventsCreated")}
                value={eventsThisYear.toLocaleString()}
                icon={Calendar}
                iconBg="bg-accent"
                subtitle={`${t("dashboard.in")} ${currentYear}`}
              />
              <PremiumStatCard
                title={t("dashboard.participationRate")}
                value={participationRate}
                icon={Percent}
                iconBg="bg-primary"
                subtitle={t("dashboard.participationSub")}
              />
              <PremiumStatCard
                title={t("dashboard.attendanceRate")}
                value={attendanceRate}
                icon={ListChecks}
                iconBg="bg-success"
                subtitle={t("dashboard.attendanceSub")}
              />
            </>
          )}
        </div>
      </div>

      {/* ── SECONDARY KPI Cards ── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">{t("dashboard.secondaryMetrics")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <PremiumStatCard
            title={t("dashboard.avgFillRate")}
            value={avgFillRate}
            icon={BarChart3}
            iconBg="bg-secondary"
            subtitle={t("dashboard.avgFillSub")}
          />
          <PremiumStatCard
            title={t("dashboard.waitlistRequests")}
            value={totalWaitlist.toLocaleString()}
            icon={Clock}
            iconBg="bg-warning"
            changeType={totalWaitlist > 0 ? "negative" : "neutral"}
            change={totalWaitlist > 0 ? `${totalWaitlist} ${t("dashboard.waiting")}` : t("dashboard.noWaitlist")}
          />
          <PremiumStatCard
            title={t("dashboard.repeatParticipants")}
            value={repeatParticipants.toLocaleString()}
            icon={Repeat}
            iconBg="bg-accent"
            subtitle={t("dashboard.repeatSub")}
          />
          <PremiumStatCard
            title={t("dashboard.newUsersMonth")}
            value={newUsersMonth.toLocaleString()}
            icon={UserPlus}
            iconBg="bg-primary"
            subtitle={format(new Date(), "MMMM yyyy")}
          />
          <PremiumStatCard
            title={t("dashboard.topCategory")}
            value={topCategory}
            icon={Trophy}
            iconBg="bg-secondary"
            subtitle={t("dashboard.topCategorySub")}
          />
        </div>
      </div>

      {/* ── Operational Quick Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PremiumStatCard
          title={t("dashboard.organizers")}
          value={totalOrganizers.toLocaleString()}
          icon={Building2}
          iconBg="bg-secondary"
        />
        <PremiumStatCard
          title={t("dashboard.openIssues")}
          value={openIssues.toLocaleString()}
          icon={AlertTriangle}
          changeType={openIssues > 0 ? "negative" : "positive"}
          change={openIssues === 0 ? t("dashboard.allClear") : `${openIssues} ${t("dashboard.needAttention")}`}
          iconBg="bg-destructive"
        />
        <PremiumStatCard
          title={t("dashboard.totalEvents")}
          value={(eventsThisYear).toLocaleString()}
          icon={Calendar}
          iconBg="bg-accent"
          subtitle={t("dashboard.allTime")}
        />
        <PremiumStatCard
          title={t("dashboard.communityHealth")}
          value={
            Number(attendanceRate.replace('%', '')) > 70 ? t("dashboard.excellent") :
            Number(attendanceRate.replace('%', '')) > 40 ? t("dashboard.good") : t("dashboard.needsWork")
          }
          icon={Activity}
          iconBg="bg-success"
          changeType={Number(attendanceRate.replace('%', '')) > 40 ? "positive" : "negative"}
          change={`${attendanceRate} ${t("dashboard.attendance")}`}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title={t("dashboard.eventsRegistrations")} icon={Calendar} className="lg:col-span-2">
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
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: chartTheme.tickFill }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: chartTheme.tickFill }} axisLine={false} tickLine={false} />
              <Tooltip {...chartTheme.tooltipStyle} cursor={{ fill: chartTheme.cursorFill }} />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
              <Bar dataKey="events" fill="url(#barEvents)" radius={[6, 6, 0, 0]} maxBarSize={32} />
              <Bar dataKey="registrations" fill="url(#barRegs)" radius={[6, 6, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("dashboard.categoryDistribution")}>
          {categoryData.length === 0 ? (
            <div className="flex items-center justify-center h-[280px]">
              <p className="text-muted-foreground text-sm">{t("dashboard.noCategoriesYet")}</p>
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
                        <text x={x} y={y} textAnchor={x > cxPos ? "start" : "end"} dominantBaseline="central" fill={chartTheme.pieLabelFill} fontSize={11} fontWeight={600}>
                          {`${(percent * 100).toFixed(0)}%`}
                        </text>
                      );
                    }}
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...chartTheme.tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2 px-2">
                {categoryData.map((entry, i) => {
                  const total = categoryData.reduce((sum, d) => sum + d.value, 0);
                  const pct = total > 0 ? ((entry.value / total) * 100).toFixed(0) : "0";
                  return (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
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
        <ChartCard title={t("dashboard.issuesTrend")}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={issuesTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 12, fill: chartTheme.tickFill }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: chartTheme.tickFill }} axisLine={false} tickLine={false} />
              <Tooltip {...chartTheme.tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
              <Line type="monotone" dataKey="opened" stroke="hsl(0, 65%, 50%)" strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2, fill: chartTheme.dotFill }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="resolved" stroke="hsl(140, 50%, 40%)" strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2, fill: chartTheme.dotFill }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("dashboard.recentActivity")} icon={Activity} className="lg:col-span-2">
          <div className="space-y-1">
            {recentActivity.length === 0 ? (
              <div className="flex items-center justify-center h-[240px]">
                <p className="text-sm text-muted-foreground">{t("dashboard.noRecentActivity")}</p>
              </div>
            ) : (
              recentActivity.map((item, i) => {
                const config = typeConfig[item.type] || typeConfig.user;
                return (
                  <div key={i} className="flex items-center justify-between py-3 px-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-2 w-2 rounded-full shrink-0", config.dot)} />
                      <div>
                        <p className="text-sm font-medium group-hover:text-foreground transition-colors">
                          {item.action === "new_user" ? t("dashboard.newUserRegistered") :
                           item.action === "event_created" ? t("dashboard.eventCreated") :
                           t("dashboard.issueReported")}
                        </p>
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
