import { useState, useEffect, useMemo } from "react";
import { useTheme } from "next-themes";
import {
  Users, Building2, Calendar, AlertTriangle, Activity, ArrowUpRight, ArrowDownRight, Minus,
  TrendingUp, UserCheck, BarChart3, Clock, Repeat, UserPlus, Star, CloudSun, MapPin,
  CheckCircle2, ListChecks, Percent, Trophy, ShieldAlert, CalendarX, UserMinus, FileWarning,
  CreditCard, UserCog, Ban, CircleDot, ExternalLink, Bell, Info
} from "lucide-react";
import RefreshButton from "@/components/RefreshButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardFilters, type DashboardFilterValues } from "@/components/dashboard/DashboardFilters";
import { useNavigate } from "react-router-dom";
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
        boxShadow: "0 8px 32px -8px rgba(0,0,0,0.25)",
        padding: "10px 14px",
        color: getVar("--popover-foreground") || "inherit",
      },
      labelStyle: {
        color: getVar("--popover-foreground") || "inherit",
        fontWeight: 600,
      },
      itemStyle: {
        color: getVar("--popover-foreground") || "inherit",
      },
    },
    legendStyle: { fontSize: "12px", paddingTop: "12px", color: getVar("--muted-foreground") || "inherit" },
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
  onClick?: () => void;
  kpiInfo?: { definition: string; formula: string };
}

function PremiumStatCard({ title, value, icon: Icon, change, changeType = "neutral", iconBg, subtitle, onClick, kpiInfo }: PremiumStatCardProps) {
  const ChangeIcon = changeType === "positive" ? ArrowUpRight : changeType === "negative" ? ArrowDownRight : Minus;
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div
      className={cn(
        "relative rounded-xl bg-card border border-border/60 p-5 overflow-hidden transition-all",
        onClick && "cursor-pointer hover:border-primary/40 hover:shadow-md active:scale-[0.98]"
      )}
      onClick={onClick}
    >
      {/* Colored top bar */}
      <div className={cn("absolute top-0 left-0 right-0 h-1 rounded-t-xl", iconBg)} />
      {/* KPI Info tooltip */}
      {kpiInfo && (
        <div className="absolute top-2.5 right-2.5 z-10">
          <div
            className="relative"
            onMouseEnter={() => setShowInfo(true)}
            onMouseLeave={() => setShowInfo(false)}
            onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }}
          >
            <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-help" />
            {showInfo && (
              <div className="absolute right-0 top-full mt-1.5 w-56 rounded-lg border bg-popover p-3 shadow-lg text-left z-50">
                <p className="text-xs font-semibold text-foreground mb-1">{kpiInfo.definition}</p>
                <p className="text-[11px] text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded">{kpiInfo.formula}</p>
              </div>
            )}
          </div>
        </div>
      )}
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

  const navigate = useNavigate();
  const [filters, setFilters] = useState<DashboardFilterValues>({
    dateFrom: undefined,
    dateTo: undefined,
    categoryId: undefined,
    organizerId: undefined,
    eventStatus: undefined,
    membershipYear: undefined,
  });

  const openKPI = (type: string) => {
    const params = new URLSearchParams({ type });
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom.toISOString());
    if (filters.dateTo) params.set("dateTo", filters.dateTo.toISOString());
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.organizerId) params.set("organizerId", filters.organizerId);
    if (filters.eventStatus) params.set("eventStatus", filters.eventStatus);
    if (filters.membershipYear) params.set("membershipYear", filters.membershipYear);
    navigate(`/kpi?${params.toString()}`);
  };

  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;

  // ── Trend comparison: current month vs previous month ──
  const curMonthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const prevMonthStart = format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd");

  const { data: trendData } = useQuery({
    queryKey: ["kpi-trends", curMonthStart, prevMonthStart],
    queryFn: async () => {
      // Users
      const { count: usersCur } = await supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", curMonthStart);
      const { count: usersPrev } = await supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", prevMonthStart).lt("created_at", curMonthStart);

      // Active members
      const { count: membersCur } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("membership_status", "Active").eq("membership_year", currentYear);
      const { count: membersPrevYear } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("membership_status", "Active").eq("membership_year", currentYear - 1);

      // Events this month vs last month
      const { count: eventsCur } = await supabase.from("events").select("*", { count: "exact", head: true }).gte("date", curMonthStart);
      const { count: eventsPrev } = await supabase.from("events").select("*", { count: "exact", head: true }).gte("date", prevMonthStart).lt("date", curMonthStart);

      // Registrations current month vs previous month (for attendance/participation trends)
      const { data: regsCur } = await supabase.from("event_registrations").select("user_id, checked_in, status, events!inner(date)").gte("events.date", curMonthStart);
      const { data: regsPrev } = await supabase.from("event_registrations").select("user_id, checked_in, status, events!inner(date)").gte("events.date", prevMonthStart).lt("events.date", curMonthStart);

      const calcAttendance = (regs: any[] | null) => {
        if (!regs || regs.length === 0) return null;
        const total = regs.filter(r => ["registered", "paid", "attended"].includes(r.status)).length;
        const checked = regs.filter(r => r.checked_in).length;
        return total > 0 ? Math.round((checked / total) * 100) : null;
      };

      const calcParticipants = (regs: any[] | null) => {
        if (!regs) return 0;
        return new Set(regs.filter(r => r.checked_in).map(r => r.user_id)).size;
      };

      // Fill rate current vs previous
      const { data: fillCurEvents } = await supabase.from("events").select("spots_taken, spots_total").gte("date", curMonthStart).gt("spots_total", 0);
      const { data: fillPrevEvents } = await supabase.from("events").select("spots_taken, spots_total").gte("date", prevMonthStart).lt("date", curMonthStart).gt("spots_total", 0);
      const calcFill = (evts: any[] | null) => {
        if (!evts || evts.length === 0) return null;
        return Math.round(evts.reduce((s, e) => s + (e.spots_taken / e.spots_total), 0) / evts.length * 100);
      };

      // Waitlist current vs previous
      const { count: waitCur } = await supabase.from("event_registrations").select("*, events!inner(date)", { count: "exact", head: true }).eq("status", "waitlist").gte("events.date", curMonthStart);
      const { count: waitPrev } = await supabase.from("event_registrations").select("*, events!inner(date)", { count: "exact", head: true }).eq("status", "waitlist").gte("events.date", prevMonthStart).lt("events.date", curMonthStart);

      // Repeat participants (>3 check-ins) — compare year-over-year
      // Open issues current vs previous month
      const { count: issuesCur } = await supabase.from("issues").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress"]).gte("created_at", curMonthStart);
      const { count: issuesPrev } = await supabase.from("issues").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress"]).gte("created_at", prevMonthStart).lt("created_at", curMonthStart);

      return {
        newUsersCur: usersCur || 0,
        newUsersPrev: usersPrev || 0,
        membersCur: membersCur || 0,
        membersPrevYear: membersPrevYear || 0,
        eventsCur: eventsCur || 0,
        eventsPrev: eventsPrev || 0,
        attendedCur: calcParticipants(regsCur),
        attendedPrev: calcParticipants(regsPrev),
        attendanceRateCur: calcAttendance(regsCur),
        attendanceRatePrev: calcAttendance(regsPrev),
        fillRateCur: calcFill(fillCurEvents),
        fillRatePrev: calcFill(fillPrevEvents),
        waitCur: waitCur || 0,
        waitPrev: waitPrev || 0,
        issuesCur: issuesCur || 0,
        issuesPrev: issuesPrev || 0,
      };
    },
    staleTime: 300000,
  });

  // Helper to compute delta string and type
  function computeTrend(current: number | null | undefined, previous: number | null | undefined, invertPositive = false): { change?: string; changeType?: "positive" | "negative" | "neutral" } {
    if (current == null || previous == null) return {};
    if (previous === 0 && current === 0) return {};
    if (previous === 0) return { change: `+${current} vs mese prec.`, changeType: invertPositive ? "negative" : "positive" };
    const pct = Math.round(((current - previous) / previous) * 100);
    if (pct === 0) return { change: "0% vs mese prec.", changeType: "neutral" };
    const sign = pct > 0 ? "+" : "";
    const isPositive = pct > 0;
    return {
      change: `${sign}${pct}% vs mese prec.`,
      changeType: invertPositive ? (isPositive ? "negative" : "positive") : (isPositive ? "positive" : "negative"),
    };
  }

  function computeTrendAbs(current: number | null | undefined, previous: number | null | undefined, unit: string, invertPositive = false): { change?: string; changeType?: "positive" | "negative" | "neutral" } {
    if (current == null || previous == null) return {};
    const diff = current - previous;
    if (diff === 0) return { change: `0${unit} vs mese prec.`, changeType: "neutral" };
    const sign = diff > 0 ? "+" : "";
    const isPositive = diff > 0;
    return {
      change: `${sign}${diff}${unit} vs mese prec.`,
      changeType: invertPositive ? (isPositive ? "negative" : "positive") : (isPositive ? "positive" : "negative"),
    };
  }

  const trendUsers = computeTrend(trendData?.newUsersCur, trendData?.newUsersPrev);
  const trendMembers = trendData?.membersPrevYear != null && trendData?.membersPrevYear > 0
    ? computeTrend(trendData.membersCur, trendData.membersPrevYear)
    : {};
  const trendAttended = computeTrend(trendData?.attendedCur, trendData?.attendedPrev);
  const trendEvents = computeTrend(trendData?.eventsCur, trendData?.eventsPrev);
  const trendAttendanceRate = computeTrendAbs(trendData?.attendanceRateCur, trendData?.attendanceRatePrev, "pp");
  const trendFillRate = computeTrendAbs(trendData?.fillRateCur, trendData?.fillRatePrev, "pp");
  const trendWaitlist = computeTrend(trendData?.waitCur, trendData?.waitPrev, true);
  const trendIssues = computeTrend(trendData?.issuesCur, trendData?.issuesPrev, true);
  const trendNewUsers = computeTrend(trendData?.newUsersCur, trendData?.newUsersPrev);

  // ── PRIMARY KPIs ──

  const { data: totalUsers = 0, isLoading: l1 } = useQuery({
    queryKey: ["kpi-total-users", filters],
    queryFn: async () => {
      let q = supabase.from("profiles").select("*", { count: "exact", head: true });
      if (filters.dateFrom) q = q.gte("created_at", format(filters.dateFrom, "yyyy-MM-dd'T'HH:mm:ss"));
      if (filters.dateTo) q = q.lte("created_at", format(filters.dateTo, "yyyy-MM-dd'T'23:59:59"));
      if (filters.membershipYear) q = q.eq("membership_year", Number(filters.membershipYear));
      const { count } = await q;
      return count || 0;
    },
  });

  const { data: activeMembers = 0, isLoading: l2 } = useQuery({
    queryKey: ["kpi-active-members", filters],
    queryFn: async () => {
      let q = supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("membership_status", "Active");
      if (filters.membershipYear) q = q.eq("membership_year", Number(filters.membershipYear));
      else q = q.eq("membership_year", currentYear);
      if (filters.dateFrom) q = q.gte("created_at", format(filters.dateFrom, "yyyy-MM-dd'T'HH:mm:ss"));
      if (filters.dateTo) q = q.lte("created_at", format(filters.dateTo, "yyyy-MM-dd'T'23:59:59"));
      const { count } = await q;
      return count || 0;
    },
  });

  const { data: usersAttended = 0, isLoading: l3 } = useQuery({
    queryKey: ["kpi-users-attended", filters],
    queryFn: async () => {
      let q = supabase
        .from("event_registrations")
        .select("user_id, events!inner(date, category_id, organizer_id, status)")
        .eq("checked_in", true);
      if (filters.dateFrom) q = q.gte("events.date", format(filters.dateFrom, "yyyy-MM-dd"));
      else q = q.gte("events.date", yearStart);
      if (filters.dateTo) q = q.lte("events.date", format(filters.dateTo, "yyyy-MM-dd"));
      if (filters.categoryId) q = q.eq("events.category_id", filters.categoryId);
      if (filters.organizerId) q = q.eq("events.organizer_id", filters.organizerId);
      if (filters.eventStatus) q = q.eq("events.status", filters.eventStatus as any);
      const { data } = await q;
      if (!data) return 0;
      const uniqueUsers = new Set(data.map((r: any) => r.user_id));
      return uniqueUsers.size;
    },
  });

  const { data: eventsThisYear = 0, isLoading: l4 } = useQuery({
    queryKey: ["kpi-events-year", filters],
    queryFn: async () => {
      let q = supabase
        .from("events")
        .select("*", { count: "exact", head: true });
      if (filters.dateFrom) q = q.gte("date", format(filters.dateFrom, "yyyy-MM-dd"));
      else q = q.gte("date", yearStart);
      if (filters.dateTo) q = q.lte("date", format(filters.dateTo, "yyyy-MM-dd"));
      if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
      if (filters.organizerId) q = q.eq("organizer_id", filters.organizerId);
      if (filters.eventStatus) q = q.eq("status", filters.eventStatus as any);
      const { count } = await q;
      return count || 0;
    },
  });

  const { data: participationRate = "0%", isLoading: l5 } = useQuery({
    queryKey: ["kpi-participation-rate", totalUsers, filters],
    queryFn: async () => {
      let q = supabase
        .from("event_registrations")
        .select("user_id, events!inner(date, category_id, organizer_id, status)")
        .in("status", ["registered", "paid", "attended"]);
      if (filters.dateFrom) q = q.gte("events.date", format(filters.dateFrom, "yyyy-MM-dd"));
      if (filters.dateTo) q = q.lte("events.date", format(filters.dateTo, "yyyy-MM-dd"));
      if (filters.categoryId) q = q.eq("events.category_id", filters.categoryId);
      if (filters.organizerId) q = q.eq("events.organizer_id", filters.organizerId);
      if (filters.eventStatus) q = q.eq("events.status", filters.eventStatus as any);
      const { data } = await q;
      if (!data || totalUsers === 0) return "0%";
      const uniqueUsers = new Set(data.map((r: any) => r.user_id));
      return `${Math.round((uniqueUsers.size / totalUsers) * 100)}%`;
    },
    enabled: totalUsers > 0,
  });

  const { data: attendanceRate = "0%", isLoading: l6 } = useQuery({
    queryKey: ["kpi-attendance-rate", filters],
    queryFn: async () => {
      let qTotal = supabase
        .from("event_registrations")
        .select("id, events!inner(date, category_id, organizer_id, status)")
        .in("status", ["registered", "paid", "attended"]);
      let qChecked = supabase
        .from("event_registrations")
        .select("id, events!inner(date, category_id, organizer_id, status)")
        .eq("checked_in", true);
        
      [qTotal, qChecked].forEach((q: any) => {
        if (filters.dateFrom) q = q.gte("events.date", format(filters.dateFrom, "yyyy-MM-dd"));
        if (filters.dateTo) q = q.lte("events.date", format(filters.dateTo, "yyyy-MM-dd"));
        if (filters.categoryId) q = q.eq("events.category_id", filters.categoryId);
        if (filters.organizerId) q = q.eq("events.organizer_id", filters.organizerId);
        if (filters.eventStatus) q = q.eq("events.status", filters.eventStatus as any);
      });

      const [{ data: totalRegs }, { data: checkedIn }] = await Promise.all([qTotal, qChecked]);
      if (!totalRegs || totalRegs.length === 0) return "0%";
      return `${Math.round(((checkedIn?.length || 0) / totalRegs.length) * 100)}%`;
    },
  });

  // ── SECONDARY KPIs ──

  const { data: avgFillRate = "0%" } = useQuery({
    queryKey: ["kpi-fill-rate", filters],
    queryFn: async () => {
      let q = supabase
        .from("events")
        .select("spots_taken, spots_total")
        .gt("spots_total", 0);
      if (filters.dateFrom) q = q.gte("date", format(filters.dateFrom, "yyyy-MM-dd"));
      if (filters.dateTo) q = q.lte("date", format(filters.dateTo, "yyyy-MM-dd"));
      if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
      if (filters.organizerId) q = q.eq("organizer_id", filters.organizerId);
      if (filters.eventStatus) q = q.eq("status", filters.eventStatus as any);

      const { data: events } = await q;
      if (!events || events.length === 0) return "0%";
      const avgRate = events.reduce((sum: number, e: any) => sum + (e.spots_taken / e.spots_total), 0) / events.length;
      return `${Math.round(avgRate * 100)}%`;
    },
  });

  const { data: totalWaitlist = 0 } = useQuery({
    queryKey: ["kpi-waitlist", filters],
    queryFn: async () => {
      let q = supabase
        .from("event_registrations")
        .select("id, events!inner(date, category_id, organizer_id, status)")
        .eq("status", "waitlist");
      if (filters.dateFrom) q = q.gte("events.date", format(filters.dateFrom, "yyyy-MM-dd"));
      if (filters.dateTo) q = q.lte("events.date", format(filters.dateTo, "yyyy-MM-dd"));
      if (filters.categoryId) q = q.eq("events.category_id", filters.categoryId);
      if (filters.organizerId) q = q.eq("events.organizer_id", filters.organizerId);
      if (filters.eventStatus) q = q.eq("events.status", filters.eventStatus as any);
      const { data } = await q;
      return data?.length || 0;
    },
  });

  const { data: repeatParticipants = 0 } = useQuery({
    queryKey: ["kpi-repeat", filters],
    queryFn: async () => {
      let q = supabase
        .from("event_registrations")
        .select("user_id, events!inner(date, category_id, organizer_id, status)")
        .eq("checked_in", true);
      if (filters.dateFrom) q = q.gte("events.date", format(filters.dateFrom, "yyyy-MM-dd"));
      if (filters.dateTo) q = q.lte("events.date", format(filters.dateTo, "yyyy-MM-dd"));
      if (filters.categoryId) q = q.eq("events.category_id", filters.categoryId);
      if (filters.organizerId) q = q.eq("events.organizer_id", filters.organizerId);
      if (filters.eventStatus) q = q.eq("events.status", filters.eventStatus as any);
      const { data } = await q;
      if (!data) return 0;
      const counts: Record<string, number> = {};
      data.forEach((r: any) => { counts[r.user_id] = (counts[r.user_id] || 0) + 1; });
      return Object.values(counts).filter((c) => c > 3).length;
    },
  });

  const { data: newUsersMonth = 0 } = useQuery({
    queryKey: ["kpi-new-users-month", filters],
    queryFn: async () => {
      let q = supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });
      if (filters.dateFrom) q = q.gte("created_at", format(filters.dateFrom, "yyyy-MM-dd'T'HH:mm:ss"));
      else q = q.gte("created_at", format(startOfMonth(new Date()), "yyyy-MM-dd"));
      if (filters.dateTo) q = q.lte("created_at", format(filters.dateTo, "yyyy-MM-dd'T'23:59:59"));
      if (filters.membershipYear) q = q.eq("membership_year", Number(filters.membershipYear));

      const { count } = await q;
      return count || 0;
    },
  });

  const { data: topCategory = "N/A" } = useQuery({
    queryKey: ["kpi-top-category", filters],
    queryFn: async () => {
      let q = supabase.from("events").select("category_id");
      if (filters.dateFrom) q = q.gte("date", format(filters.dateFrom, "yyyy-MM-dd"));
      if (filters.dateTo) q = q.lte("date", format(filters.dateTo, "yyyy-MM-dd"));
      if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
      if (filters.organizerId) q = q.eq("organizer_id", filters.organizerId);
      if (filters.eventStatus) q = q.eq("status", filters.eventStatus as any);

      const { data: events } = await q;
      const { data: cats } = await supabase.from("event_categories").select("id, name");
      if (!events || !cats || events.length === 0) return "N/A";
      const counts: Record<string, number> = {};
      events.forEach((e: any) => { if (e.category_id) counts[e.category_id] = (counts[e.category_id] || 0) + 1; });
      const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
      return cats.find((c) => c.id === topId)?.name || "N/A";
    },
  });

  // ── EXISTING CHART DATA ──

  const { data: openIssues = 0 } = useQuery({
    queryKey: ["stats-issues", filters],
    queryFn: async () => {
      let q = supabase.from("issues").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress"]);
      if (filters.dateFrom) q = q.gte("created_at", format(filters.dateFrom, "yyyy-MM-dd'T'HH:mm:ss"));
      if (filters.dateTo) q = q.lte("created_at", format(filters.dateTo, "yyyy-MM-dd'T'23:59:59"));
      const { count } = await q;
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
    queryKey: ["stats-categories", filters],
    queryFn: async () => {
      let q = supabase.from("events").select("category_id");
      if (filters.dateFrom) q = q.gte("date", format(filters.dateFrom, "yyyy-MM-dd"));
      if (filters.dateTo) q = q.lte("date", format(filters.dateTo, "yyyy-MM-dd"));
      if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
      if (filters.organizerId) q = q.eq("organizer_id", filters.organizerId);
      if (filters.eventStatus) q = q.eq("status", filters.eventStatus as any);

      const { data: events } = await q;
      const { data: categories } = await supabase.from("event_categories").select("id, name");
      if (!categories) return [];
      return categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        value: events?.filter((e: any) => e.category_id === cat.id).length || 0,
      })).filter((c) => c.value > 0);
    },
  });

  const { data: eventsByMonth = [] } = useQuery({
    queryKey: ["stats-events-month", filters],
    queryFn: async () => {
      let eq = supabase.from("events").select("date, id");
      if (filters.categoryId) eq = eq.eq("category_id", filters.categoryId);
      if (filters.organizerId) eq = eq.eq("organizer_id", filters.organizerId);
      if (filters.eventStatus) eq = eq.eq("status", filters.eventStatus as any);
      const { data: events } = await eq;

      let rq = supabase.from("event_registrations").select("created_at, events!inner(category_id, organizer_id, status)");
      if (filters.categoryId) rq = rq.eq("events.category_id", filters.categoryId);
      if (filters.organizerId) rq = rq.eq("events.organizer_id", filters.organizerId);
      if (filters.eventStatus) rq = rq.eq("events.status", filters.eventStatus as any) as any;
      const { data: regs } = await rq;

      const months: { month: string; events: number; registrations: number; dateFrom: string; dateTo: string }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const label = format(d, "MMM");
        const start = format(startOfMonth(d), "yyyy-MM-dd");
        const end = format(startOfMonth(subMonths(d, -1)), "yyyy-MM-dd");
        months.push({
          month: label,
          events: events?.filter((e: any) => e.date >= start && e.date < end).length || 0,
          registrations: regs?.filter((r: any) => r.created_at >= start && r.created_at < end).length || 0,
          dateFrom: start,
          dateTo: end,
        });
      }
      return months;
    },
  });

  const { data: issuesTrend = [] } = useQuery({
    queryKey: ["stats-issues-trend", filters],
    queryFn: async () => {
      let q = supabase.from("issues").select("created_at, status, resolved_at");
      if (filters.dateFrom) q = q.gte("created_at", format(filters.dateFrom, "yyyy-MM-dd'T'HH:mm:ss"));
      if (filters.dateTo) q = q.lte("created_at", format(filters.dateTo, "yyyy-MM-dd'T'23:59:59"));
      
      const { data: issues } = await q;
      const weeks: { week: string; opened: number; resolved: number; dateFrom: string; dateTo: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const start = new Date(); start.setDate(start.getDate() - (i + 1) * 7);
        const end = new Date(); end.setDate(end.getDate() - i * 7);
        weeks.push({
          week: `W${6 - i}`,
          opened: issues?.filter((is: any) => new Date(is.created_at) >= start && new Date(is.created_at) < end).length || 0,
          resolved: issues?.filter((is: any) => is.resolved_at && new Date(is.resolved_at) >= start && new Date(is.resolved_at) < end).length || 0,
          dateFrom: start.toISOString(),
          dateTo: end.toISOString(),
        });
      }
      return weeks;
    },
  });

  // ── ATTENTION REQUIRED ALERTS ──
  const { data: alerts = [] } = useQuery({
    queryKey: ["dashboard-alerts"],
    queryFn: async () => {
      const alertItems: { id: string; message: string; severity: "warning" | "danger"; route: string; icon: string }[] = [];

      // 1. Memberships expiring (active but from previous year)
      const { count: expiringMembers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("membership_status", "Active")
        .lt("membership_year", currentYear);
      if (expiringMembers && expiringMembers > 0) {
        alertItems.push({
          id: "expiring-members",
          message: `${expiringMembers} tessere in scadenza (anno precedente)`,
          severity: "warning",
          route: "/members?status=expiring",
          icon: "membership",
        });
      }

      // 2. Events with high no-show rate (>40%)
      const { data: recentEventsForNoShow } = await supabase
        .from("events")
        .select("id, title")
        .in("status", ["past", "closed"])
        .order("date", { ascending: false })
        .limit(50);
      if (recentEventsForNoShow && recentEventsForNoShow.length > 0) {
        const eventIds = recentEventsForNoShow.map(e => e.id);
        const { data: regsForNoShow } = await supabase
          .from("event_registrations")
          .select("event_id, checked_in, status")
          .in("event_id", eventIds)
          .in("status", ["registered", "paid", "attended", "no_show"]);
        if (regsForNoShow) {
          const byEvent: Record<string, { total: number; noShow: number }> = {};
          regsForNoShow.forEach(r => {
            if (!byEvent[r.event_id]) byEvent[r.event_id] = { total: 0, noShow: 0 };
            byEvent[r.event_id].total++;
            if (!r.checked_in && r.status !== "cancelled") byEvent[r.event_id].noShow++;
          });
          const highNoShow = Object.entries(byEvent).filter(([_, v]) => v.total >= 3 && (v.noShow / v.total) > 0.4).length;
          if (highNoShow > 0) {
            alertItems.push({
              id: "high-no-show",
              message: `${highNoShow} eventi con no-show superiore al 40%`,
              severity: "danger",
              route: "/events?sort=no-show",
              icon: "noshow",
            });
          }
        }
      }

      // 3. Open issues older than 5 days
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      const { count: oldIssues } = await supabase
        .from("issues")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "in_progress"])
        .lt("created_at", fiveDaysAgo.toISOString());
      if (oldIssues && oldIssues > 0) {
        alertItems.push({
          id: "old-issues",
          message: `${oldIssues} segnalazioni aperte da oltre 5 giorni`,
          severity: "danger",
          route: "/issues?sort=oldest",
          icon: "issue",
        });
      }

      // 4. Events with 0 registrations (upcoming)
      const today = format(new Date(), "yyyy-MM-dd");
      const { count: emptyEvents } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .gte("date", today)
        .in("status", ["published", "available"])
        .eq("spots_taken", 0);
      if (emptyEvents && emptyEvents > 0) {
        alertItems.push({
          id: "empty-events",
          message: `${emptyEvents} eventi senza iscritti`,
          severity: "warning",
          route: "/events?filter=empty",
          icon: "empty-event",
        });
      }

      // 5. Pending approval registrations
      const { count: pendingApprovals } = await supabase
        .from("event_registrations")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending_approval");
      if (pendingApprovals && pendingApprovals > 0) {
        alertItems.push({
          id: "pending-approvals",
          message: `${pendingApprovals} iscrizioni in attesa di approvazione`,
          severity: "warning",
          route: "/events?filter=pending",
          icon: "approval",
        });
      }

      return alertItems;
    },
    staleTime: 120000,
  });

  const { data: recentActivity = [] } = useQuery({
    queryKey: ["stats-recent"],
    queryFn: async () => {
      const activities: { action: string; detail: string; time: string; type: string; entityId?: string; route?: string }[] = [];

      // New users registered
      const { data: recentUsers } = await supabase.from("profiles").select("id, first_name, last_name, created_at, onboarding_completed, membership_status").order("created_at", { ascending: false }).limit(5);
      recentUsers?.forEach((u) => {
        activities.push({ action: "new_user", detail: `${u.first_name} ${u.last_name}`, time: u.created_at, type: "user", entityId: u.id, route: `/users` });
        if (u.onboarding_completed) {
          activities.push({ action: "onboarding_completed", detail: `${u.first_name} ${u.last_name}`, time: u.created_at, type: "user", entityId: u.id, route: `/users` });
        }
        if (u.membership_status === "Active") {
          activities.push({ action: "membership_activated", detail: `${u.first_name} ${u.last_name}`, time: u.created_at, type: "membership", entityId: u.id, route: `/members` });
        }
      });

      // Events created / updated / cancelled
      const { data: recentEvents } = await supabase.from("events").select("id, title, created_at, updated_at, status").order("updated_at", { ascending: false }).limit(5);
      recentEvents?.forEach((e) => {
        activities.push({ action: "event_created", detail: e.title, time: e.created_at, type: "event", entityId: e.id, route: `/events` });
        if (e.status === "cancelled") {
          activities.push({ action: "event_cancelled", detail: e.title, time: e.updated_at, type: "event", entityId: e.id, route: `/events` });
        }
      });

      // Issues opened / resolved
      const { data: recentIssues } = await supabase.from("issues").select("id, title, created_at, status, resolved_at").order("created_at", { ascending: false }).limit(5);
      recentIssues?.forEach((is) => {
        activities.push({ action: "issue_opened", detail: is.title, time: is.created_at, type: "issue", entityId: is.id, route: `/issues` });
        if (is.status === "resolved" && is.resolved_at) {
          activities.push({ action: "issue_resolved", detail: is.title, time: is.resolved_at, type: "issue", entityId: is.id, route: `/issues` });
        }
      });

      // Waitlist registrations
      const { data: waitlistRegs } = await supabase
        .from("event_registrations")
        .select("id, created_at, status, user_id, events!inner(title)")
        .eq("status", "waitlist")
        .order("created_at", { ascending: false })
        .limit(3);
      waitlistRegs?.forEach((r: any) => {
        activities.push({ action: "waitlist_activated", detail: r.events?.title || "Evento", time: r.created_at, type: "event", route: `/events` });
      });

      // Pending approvals
      const { data: pendingRegs } = await supabase
        .from("event_registrations")
        .select("id, created_at, status, events!inner(title)")
        .eq("status", "pending_approval")
        .order("created_at", { ascending: false })
        .limit(3);
      pendingRegs?.forEach((r: any) => {
        activities.push({ action: "approval_requested", detail: r.events?.title || "Evento", time: r.created_at, type: "event", route: `/events` });
      });

      // Paid registrations
      const { data: paidRegs } = await supabase
        .from("event_registrations")
        .select("id, created_at, payment_status, events!inner(title)")
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false })
        .limit(3);
      paidRegs?.forEach((r: any) => {
        activities.push({ action: "payment_completed", detail: r.events?.title || "Evento", time: r.created_at, type: "payment", route: `/events` });
      });

      return activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 12);
    },
  });

  const typeConfig: Record<string, { bg: string; dot: string }> = {
    user: { bg: "bg-primary/8 text-primary border-primary/20", dot: "bg-primary" },
    event: { bg: "bg-accent/8 text-accent border-accent/20", dot: "bg-accent" },
    issue: { bg: "bg-destructive/8 text-destructive border-destructive/20", dot: "bg-destructive" },
    membership: { bg: "bg-success/8 text-success border-success/20", dot: "bg-success" },
    payment: { bg: "bg-secondary/8 text-secondary border-secondary/20", dot: "bg-secondary" },
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
          <RefreshButton queryKeys={[["kpi-total-users"], ["kpi-active-members"], ["kpi-users-attended"], ["kpi-events-year"], ["kpi-participation-rate"], ["kpi-attendance-rate"], ["kpi-trends"], ["stats-issues"], ["stats-organizers"], ["stats-categories"], ["stats-events-month"], ["stats-issues-trend"], ["stats-recent"], ["dashboard-alerts"]]} />
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

      {/* ── Filters ── */}
      <DashboardFilters filters={filters} onChange={setFilters} />

      {/* ── Attention Required ── */}
      {alerts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <p className="text-xs font-semibold uppercase tracking-wider text-destructive">👉 Attenzione richiesta</p>
            <Badge variant="destructive" className="h-5 px-1.5 text-[10px] font-bold">{alerts.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {alerts.map((alert) => {
              const alertIcons: Record<string, typeof AlertTriangle> = {
                membership: UserMinus,
                noshow: Ban,
                issue: FileWarning,
                "empty-event": CalendarX,
                approval: UserCog,
              };
              const AlertIcon = alertIcons[alert.icon] || AlertTriangle;
              return (
                <div
                  key={alert.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md active:scale-[0.98]",
                    alert.severity === "danger"
                      ? "border-destructive/30 bg-destructive/5 hover:border-destructive/50"
                      : "border-warning/30 bg-warning/5 hover:border-warning/50"
                  )}
                  onClick={() => navigate(alert.route)}
                >
                  <div className={cn(
                    "p-2 rounded-lg shrink-0",
                    alert.severity === "danger" ? "bg-destructive/10" : "bg-warning/10"
                  )}>
                    <AlertIcon className={cn("h-4 w-4", alert.severity === "danger" ? "text-destructive" : "text-warning")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground leading-tight">{alert.message}</p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}
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
                change={trendUsers.change}
                changeType={trendUsers.changeType}
                onClick={() => openKPI("total-users")}
                kpiInfo={{ definition: "Utenti registrati sulla piattaforma", formula: "COUNT(profiles)" }}
              />
              <PremiumStatCard
                title={t("dashboard.activeMembers")}
                value={activeMembers.toLocaleString()}
                icon={UserCheck}
                iconBg="bg-success"
                subtitle={`${t("dashboard.paidMembership")} ${currentYear}`}
                change={trendMembers.change ? trendMembers.change.replace("mese prec.", `${currentYear - 1}`) : undefined}
                changeType={trendMembers.changeType}
                onClick={() => openKPI("active-members")}
                kpiInfo={{ definition: "Tesserati con membership attiva", formula: "COUNT(membership_status = 'Active')" }}
              />
              <PremiumStatCard
                title={t("dashboard.usersAttended")}
                value={usersAttended.toLocaleString()}
                icon={CheckCircle2}
                iconBg="bg-secondary"
                subtitle={`${t("dashboard.atLeast1Event")} ${currentYear}`}
                change={trendAttended.change}
                changeType={trendAttended.changeType}
                onClick={() => openKPI("participating-users")}
                kpiInfo={{ definition: "Utenti partecipanti", formula: "COUNT(DISTINCT user_id) con almeno 1 iscrizione" }}
              />
              <PremiumStatCard
                title={t("dashboard.eventsCreated")}
                value={eventsThisYear.toLocaleString()}
                icon={Calendar}
                iconBg="bg-accent"
                subtitle={`${t("dashboard.in")} ${currentYear}`}
                change={trendEvents.change}
                changeType={trendEvents.changeType}
                onClick={() => openKPI("events-created")}
                kpiInfo={{ definition: "Eventi creati nell'anno corrente", formula: "COUNT(events) anno corrente" }}
              />
              <PremiumStatCard
                title={t("dashboard.participationRate")}
                value={participationRate}
                icon={Percent}
                iconBg="bg-primary"
                subtitle={t("dashboard.participationSub")}
                onClick={() => openKPI("participation-rate")}
                kpiInfo={{ definition: "Tasso partecipazione", formula: "Utenti con ≥1 iscrizione / utenti totali × 100" }}
              />
              <PremiumStatCard
                title={t("dashboard.attendanceRate")}
                value={attendanceRate}
                icon={ListChecks}
                iconBg="bg-success"
                subtitle={t("dashboard.attendanceSub")}
                change={trendAttendanceRate.change}
                changeType={trendAttendanceRate.changeType}
                onClick={() => openKPI("attendance-rate")}
                kpiInfo={{ definition: "Tasso presenza", formula: "Check-in completati / iscrizioni totali × 100" }}
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
            change={trendFillRate.change}
            changeType={trendFillRate.changeType}
            onClick={() => openKPI("fill-rate")}
            kpiInfo={{ definition: "Tasso riempimento medio", formula: "Iscrizioni / capacità evento × 100" }}
          />
          <PremiumStatCard
            title={t("dashboard.waitlistRequests")}
            value={totalWaitlist.toLocaleString()}
            icon={Clock}
            iconBg="bg-warning"
            change={trendWaitlist.change}
            changeType={trendWaitlist.changeType}
            onClick={() => openKPI("waitlist")}
            kpiInfo={{ definition: "Richieste in lista d'attesa", formula: "COUNT(status = 'waitlist')" }}
          />
          <PremiumStatCard
            title={t("dashboard.repeatParticipants")}
            value={repeatParticipants.toLocaleString()}
            icon={Repeat}
            iconBg="bg-accent"
            subtitle={t("dashboard.repeatSub")}
            onClick={() => openKPI("repeat-participants")}
            kpiInfo={{ definition: "Partecipanti abituali", formula: "COUNT(utenti con >3 eventi)" }}
          />
          <PremiumStatCard
            title={t("dashboard.newUsersMonth")}
            value={newUsersMonth.toLocaleString()}
            icon={UserPlus}
            iconBg="bg-primary"
            subtitle={format(new Date(), "MMMM yyyy")}
            change={trendNewUsers.change}
            changeType={trendNewUsers.changeType}
            onClick={() => openKPI("total-users")}
            kpiInfo={{ definition: "Nuovi utenti nel mese corrente", formula: "COUNT(created_at nel mese corrente)" }}
          />
          <PremiumStatCard
            title={t("dashboard.topCategory")}
            value={topCategory}
            icon={Trophy}
            iconBg="bg-secondary"
            subtitle={t("dashboard.topCategorySub")}
            onClick={() => openKPI("top-category")}
            kpiInfo={{ definition: "Categoria con più iscrizioni", formula: "MAX(registrazioni) per categoria" }}
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
          kpiInfo={{ definition: "Organizzatori e admin attivi", formula: "COUNT(ruolo = organizer o admin)" }}
        />
        <PremiumStatCard
          title={t("dashboard.openIssues")}
          value={openIssues.toLocaleString()}
          icon={AlertTriangle}
          change={trendIssues.change}
          changeType={trendIssues.changeType}
          iconBg="bg-destructive"
          onClick={() => openKPI("open-issues")}
          kpiInfo={{ definition: "Segnalazioni aperte", formula: "COUNT(issues status = 'open')" }}
        />
        <PremiumStatCard
          title={t("dashboard.totalEvents")}
          value={(eventsThisYear).toLocaleString()}
          icon={Calendar}
          iconBg="bg-accent"
          subtitle={t("dashboard.allTime")}
          onClick={() => openKPI("events-created")}
          kpiInfo={{ definition: "Totale eventi creati", formula: "COUNT(events)" }}
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
          onClick={() => openKPI("community-health")}
          kpiInfo={{ definition: "Salute community", formula: "Basata su tasso presenza: >70% Ottima, >40% Buona, ≤40% Da migliorare" }}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title={t("dashboard.eventsRegistrations")} icon={Calendar} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={eventsByMonth} barGap={4} className="cursor-pointer"
              onClick={(data) => {
                if (data?.activePayload?.[0]?.payload) {
                  const payload = data.activePayload[0].payload;
                  navigate(`/events?dateFrom=${payload.dateFrom}&dateTo=${payload.dateTo}`);
                }
              }}
            >
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
              <Legend wrapperStyle={chartTheme.legendStyle} />
              <Bar dataKey="events" fill="url(#barEvents)" radius={[6, 6, 0, 0]} maxBarSize={32} className="cursor-pointer" />
              <Bar dataKey="registrations" fill="url(#barRegs)" radius={[6, 6, 0, 0]} maxBarSize={32} className="cursor-pointer" />
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
                    className="cursor-pointer"
                    onClick={(_, index) => {
                      const cat = categoryData[index];
                      if (cat?.id) navigate(`/events?categoryId=${cat.id}`);
                    }}
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
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} className="cursor-pointer hover:opacity-80 transition-opacity" />
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
                    <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => navigate(`/events?categoryId=${entry.id}`)}
                    >
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
            <LineChart data={issuesTrend} className="cursor-pointer"
              onClick={(data) => {
                if (data?.activePayload?.[0]?.payload) {
                  const payload = data.activePayload[0].payload;
                  navigate(`/issues?dateFrom=${encodeURIComponent(payload.dateFrom)}&dateTo=${encodeURIComponent(payload.dateTo)}`);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 12, fill: chartTheme.tickFill }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: chartTheme.tickFill }} axisLine={false} tickLine={false} />
              <Tooltip {...chartTheme.tooltipStyle} />
              <Legend wrapperStyle={chartTheme.legendStyle} />
              <Line type="monotone" dataKey="opened" stroke="hsl(0, 65%, 50%)" strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2, fill: chartTheme.dotFill }} activeDot={{ r: 7, className: "cursor-pointer" }} />
              <Line type="monotone" dataKey="resolved" stroke="hsl(140, 50%, 40%)" strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2, fill: chartTheme.dotFill }} activeDot={{ r: 7, className: "cursor-pointer" }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("dashboard.recentActivity")} icon={Activity} className="lg:col-span-2">
          <div className="space-y-0.5 max-h-[320px] overflow-y-auto">
            {recentActivity.length === 0 ? (
              <div className="flex items-center justify-center h-[240px]">
                <p className="text-sm text-muted-foreground">{t("dashboard.noRecentActivity")}</p>
              </div>
            ) : (
              recentActivity.map((item, i) => {
                const config = typeConfig[item.type] || typeConfig.user;
                const actionLabels: Record<string, string> = {
                  new_user: "Nuovo utente registrato",
                  onboarding_completed: "Onboarding completato",
                  membership_activated: "Tessera attivata",
                  event_created: "Evento creato",
                  event_cancelled: "Evento annullato",
                  issue_opened: "Segnalazione aperta",
                  issue_resolved: "Segnalazione risolta",
                  waitlist_activated: "Lista d'attesa attivata",
                  approval_requested: "Approvazione richiesta",
                  payment_completed: "Pagamento completato",
                };
                const actionIcons: Record<string, typeof Users> = {
                  new_user: UserPlus,
                  onboarding_completed: CheckCircle2,
                  membership_activated: UserCheck,
                  event_created: Calendar,
                  event_cancelled: CalendarX,
                  issue_opened: FileWarning,
                  issue_resolved: CheckCircle2,
                  waitlist_activated: Clock,
                  approval_requested: UserCog,
                  payment_completed: CreditCard,
                };
                const ActionIcon = actionIcons[item.action] || CircleDot;
                const typeLabels: Record<string, string> = {
                  user: "Utente",
                  event: "Evento",
                  issue: "Segnalazione",
                  membership: "Tessera",
                  payment: "Pagamento",
                };
                return (
                  <div
                    key={`${item.action}-${i}`}
                    className={cn(
                      "flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors",
                      item.route && "cursor-pointer hover:bg-muted/50"
                    )}
                    onClick={() => item.route && navigate(item.route)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("p-1.5 rounded-lg shrink-0", `${config.dot}/10`)}>
                        <ActionIcon className={cn("h-3.5 w-3.5", config.dot.replace("bg-", "text-"))} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{actionLabels[item.action] || item.action}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.detail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <Badge variant="outline" className={cn("text-[10px] font-medium border", config.bg)}>
                        {typeLabels[item.type] || item.type}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap tabular-nums">{timeAgo(item.time)}</span>
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
