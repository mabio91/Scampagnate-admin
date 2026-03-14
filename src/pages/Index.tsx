import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, CalendarDays, Ticket, Activity, Crown, AlertCircle, RefreshCw, UserPlus, Trophy, UsersRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Index() {
  const currentYear = new Date().getFullYear();
  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  // 1. Total Registered Users & New Users This Month
  const { data: userStats } = useQuery({
    queryKey: ["dashboard-users"],
    queryFn: async () => {
      const { count: total } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      const { count: newThisMonth } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", currentMonthStart);
      
      return {
        total: total || 0,
        newThisMonth: newThisMonth || 0,
      };
    },
  });

  // 2. Active Members (membership fee paid for current year)
  const { data: activeMembers } = useQuery({
    queryKey: ["dashboard-active-members", currentYear],
    queryFn: async () => {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("membership_year", currentYear)
        .eq("membership_status", "Active");
      return count || 0;
    },
  });

  // 3. Events Created (current year) & All Events for Fill Rate/Categories
  const { data: eventsData } = useQuery({
    queryKey: ["dashboard-events", currentYear],
    queryFn: async () => {
      const startOfYear = new Date(currentYear, 0, 1).toISOString();
      
      const { data: allEvents } = await supabase
        .from("events")
        .select("id, spots_total, spots_taken, category_id, date");
        
      const currentYearEvents = (allEvents || []).filter(e => e.date >= startOfYear.split('T')[0]);
      
      // Calculate Average Fill Rate
      let totalSpots = 0;
      let totalTaken = 0;
      (allEvents || []).forEach(e => {
        totalSpots += e.spots_total || 0;
        totalTaken += e.spots_taken || 0;
      });
      const fillRate = totalSpots > 0 ? (totalTaken / totalSpots) * 100 : 0;

      return {
        eventsThisYearCount: currentYearEvents.length,
        fillRate: Math.round(fillRate),
        events: allEvents || []
      };
    },
  });

  // 4. Categories for Most Popular Categories
  const { data: popularCategory } = useQuery({
    queryKey: ["dashboard-popular-category"],
    enabled: !!eventsData?.events.length,
    queryFn: async () => {
      const { data: categories } = await supabase.from("event_categories").select("id, name");
      if (!categories || categories.length === 0) return "N/A";

      const categoryCounts: Record<string, number> = {};
      eventsData!.events.forEach(e => {
        if (e.category_id) {
          categoryCounts[e.category_id] = (categoryCounts[e.category_id] || 0) + 1;
        }
      });

      let maxCount = 0;
      let topCatId = null;
      Object.entries(categoryCounts).forEach(([id, count]) => {
        if (count > maxCount) {
          maxCount = count;
          topCatId = id;
        }
      });

      if (!topCatId) return "N/A";
      return categories.find(c => c.id === topCatId)?.name || "N/A";
    }
  });

  // 5. Registration Metrics (Participation, Attendance, Waitlist, Repeat)
  const { data: registrationStats } = useQuery({
    queryKey: ["dashboard-registrations", currentYear],
    queryFn: async () => {
      const { data: regs } = await supabase
        .from("event_registrations")
        .select("user_id, status, checked_in, events!inner(date)");

      if (!regs) return { participationRate: 0, attendanceRate: 0, waitlistCount: 0, repeatCount: 0, attendedAtLeastOneCount: 0 };

      // Current Year Attendance Logic
      const currentYearRegs = regs.filter(r => r.events && (r.events as any).date.startsWith(currentYear.toString()));
      const uniqueAttendedCurrentYear = new Set(
        currentYearRegs.filter(r => r.checked_in).map(r => r.user_id)
      );

      // Participation Rate (users who joined AT LEAST ONE event / total unique users)
      const allUniqueParticipants = new Set(
        regs.filter(r => ["paid", "registered", "pending_approval"].includes(r.status)).map(r => r.user_id)
      );
      
      // Attendance Rate (Checked in / Total registered)
      const totalRegistered = regs.filter(r => ["paid", "registered"].includes(r.status)).length;
      const totalCheckedIn = regs.filter(r => r.checked_in).length;
      const attendanceRate = totalRegistered > 0 ? (totalCheckedIn / totalRegistered) * 100 : 0;

      // Total Waitlist Requests
      const waitlistCount = regs.filter(r => r.status === "waitlist").length;

      // Repeat Participants (> 3 events attended)
      const userAttendanceCounts: Record<string, number> = {};
      regs.filter(r => r.checked_in).forEach(r => {
        userAttendanceCounts[r.user_id] = (userAttendanceCounts[r.user_id] || 0) + 1;
      });
      const repeatCount = Object.values(userAttendanceCounts).filter(count => count > 3).length;

      return {
        participationRate: userStats?.total ? Math.round((allUniqueParticipants.size / userStats.total) * 100) : 0,
        attendanceRate: Math.round(attendanceRate),
        waitlistCount,
        repeatCount,
        attendedAtLeastOneCount: uniqueAttendedCurrentYear.size
      };
    },
    enabled: !!userStats
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
        <p className="text-muted-foreground mt-1">Platform performance and community health metrics.</p>
      </div>

      {/* Primary Metrics (First Row) */}
      <h2 className="text-xl font-semibold mt-8 mb-2 border-b pb-2">Primary Community Metrics</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Registered Users</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">All users on the platform</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Members</CardTitle>
            <Crown className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{activeMembers || 0}</div>
            <p className="text-xs text-muted-foreground">Membership paid for {currentYear}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Participants ({currentYear})</CardTitle>
            <UserCheck className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{registrationStats?.attendedAtLeastOneCount || 0}</div>
            <p className="text-xs text-muted-foreground">Attended ≥ 1 event this year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Events Created ({currentYear})</CardTitle>
            <CalendarDays className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{eventsData?.eventsThisYearCount || 0}</div>
            <p className="text-xs text-muted-foreground">Total platform events this year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Participation Rate</CardTitle>
            <Activity className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-500">{registrationStats?.participationRate || 0}%</div>
            <p className="text-xs text-muted-foreground">Joined an event / Total users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
            <UsersRound className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{registrationStats?.attendanceRate || 0}%</div>
            <p className="text-xs text-muted-foreground">Check-ins / Total registrations</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics (Second Row) */}
      <h2 className="text-xl font-semibold mt-10 mb-2 border-b pb-2">Engagement & Performance Insights</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Event Fill Rate</CardTitle>
            <Ticket className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-500">{eventsData?.fillRate || 0}%</div>
            <p className="text-xs text-muted-foreground">Avg. registrations / event capacity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Waitlist Requests</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{registrationStats?.waitlistCount || 0}</div>
            <p className="text-xs text-muted-foreground">Historically across all events</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Repeat Participants</CardTitle>
            <RefreshCw className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{registrationStats?.repeatCount || 0}</div>
            <p className="text-xs text-muted-foreground">Users who attended {">"} 3 events</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Users This Month</CardTitle>
            <UserPlus className="h-4 w-4 text-teal-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal-500">{userStats?.newThisMonth || 0}</div>
            <p className="text-xs text-muted-foreground">Registered in the current month</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Popular Category</CardTitle>
            <Trophy className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500 truncate">{popularCategory || "—"}</div>
            <p className="text-xs text-muted-foreground">By total events created</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
