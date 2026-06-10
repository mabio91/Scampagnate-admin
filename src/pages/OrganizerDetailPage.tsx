import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { isAnalyticsEventStatus } from "@/lib/analyticsEvents";

export default function OrganizerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const { data: organizer, isLoading: loadingOrg } = useQuery({
    queryKey: ["organizer-detail", id],
    queryFn: async () => {
      if (!id) return null;
      const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", id).single();
      if (error) throw error;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", id);
      let authUser: any = null;
      try {
        const res = await supabase.functions.invoke("list-users");
        if (res.data && !res.data.error) {
          authUser = res.data.find((u: any) => u.id === id);
        }
      } catch {
        // Auth metadata is optional for this detail view.
      }
      return {
        ...profile,
        roles: (roles || []).map((r) => r.role),
        email: authUser?.email || profile.email || "—",
        last_sign_in_at: authUser?.last_sign_in_at || null,
      };
    },
    enabled: !!id,
  });

  const { data: orgEvents = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["organizer-detail-events", id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase
        .from("events")
        .select(`
          id, title, date, status, spots_taken, spots_total,
          event_categories:category_id ( name, icon )
        `)
        .eq("organizer_id", id)
        .order("date", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch registrations for attendance data on past events
  const analyticsEvents = orgEvents.filter((e: any) => isAnalyticsEventStatus(e.status));
  const pastEventIds = analyticsEvents
    .filter((e: any) => new Date(e.date) < new Date(new Date().setHours(0, 0, 0, 0)))
    .map((e: any) => e.id);
  
  const { data: registrations = [] } = useQuery({
    queryKey: ["organizer-detail-regs", pastEventIds],
    queryFn: async () => {
      if (!pastEventIds.length) return [];
      const { data } = await supabase
        .from("event_registrations")
        .select("event_id, status, checked_in")
        .in("event_id", pastEventIds);
      return data || [];
    },
    enabled: pastEventIds.length > 0,
  });

  if (loadingOrg) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  if (!organizer) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/organizers")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Button>
        <p className="text-muted-foreground">{t("common.noResults")}</p>
      </div>
    );
  }

  // Performance metrics
  const totalEvents = analyticsEvents.length;
  const pastEvents = analyticsEvents.filter((e: any) => new Date(e.date) < new Date(new Date().setHours(0, 0, 0, 0)));
  const cancelledEvents = analyticsEvents.filter((e: any) => e.status === "cancelled");
  const cancellationRate = totalEvents > 0 ? ((cancelledEvents.length / totalEvents) * 100).toFixed(1) : "0";

  const fillRates = analyticsEvents
    .filter((e: any) => e.spots_total > 0 && e.status !== "cancelled")
    .map((e: any) => (e.spots_taken / e.spots_total) * 100);
  const avgFillRate = fillRates.length > 0 ? (fillRates.reduce((a: number, b: number) => a + b, 0) / fillRates.length).toFixed(1) : "0";

  // Attendance & no-show for past events
  const regsByEvent: Record<string, { total: number; checkedIn: number }> = {};
  registrations.forEach((r: any) => {
    if (!regsByEvent[r.event_id]) regsByEvent[r.event_id] = { total: 0, checkedIn: 0 };
    if (r.status === "registered" || r.status === "paid") {
      regsByEvent[r.event_id].total++;
      if (r.checked_in) regsByEvent[r.event_id].checkedIn++;
    }
  });

  const attendanceRates = Object.values(regsByEvent).filter((r) => r.total > 0).map((r) => (r.checkedIn / r.total) * 100);
  const avgAttendance = attendanceRates.length > 0 ? (attendanceRates.reduce((a, b) => a + b, 0) / attendanceRates.length).toFixed(1) : "0";

  const totalNoShows = Object.values(regsByEvent).reduce((sum, r) => sum + (r.total - r.checkedIn), 0);
  const totalPastRegs = Object.values(regsByEvent).reduce((sum, r) => sum + r.total, 0);
  const noShowRate = totalPastRegs > 0 ? ((totalNoShows / totalPastRegs) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/organizers")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{organizer.first_name} {organizer.last_name}</h1>
          <p className="text-muted-foreground">{organizer.email}</p>
        </div>
        <div className="flex gap-2 ml-auto">
          {organizer.roles.map((r: string) => (
            <Badge key={r} variant={r === "admin" ? "default" : r === "organizer" ? "secondary" : "outline"}>{r}</Badge>
          ))}
        </div>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="profile">{t("users.profileOverview")}</TabsTrigger>
          <TabsTrigger value="events">{t("users.events")}</TabsTrigger>
          <TabsTrigger value="performance">{t("orgDetail.performance")}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 mt-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">{t("users.personalInfo")}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <InfoField label={t("common.email")} value={organizer.email} />
                <InfoField label={t("common.phone")} value={organizer.phone || "—"} />
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t("common.status")}</p>
                  <Badge variant={organizer.account_status === "Active" ? "outline" : "default"}
                    className={organizer.account_status === "Active" ? "bg-green-500/10 text-green-500" : ""}
                  >
                    {organizer.account_status || "Active"}
                  </Badge>
                </div>
                <InfoField label={t("users.lastLogin")} value={organizer.last_sign_in_at ? new Date(organizer.last_sign_in_at).toLocaleString() : t("users.never")} />
                <InfoField label={t("orgDetail.eventsCreated")} value={String(totalEvents)} />
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t("users.membershipStatus")}</p>
                  <Badge variant={organizer.membership_status === "Active" ? "outline" : "secondary"}>
                    {organizer.membership_status || "None"}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t("users.role")}</p>
                  <div className="flex gap-1">
                    {organizer.roles.map((r: string) => <Badge key={r} variant="secondary">{r}</Badge>)}
                  </div>
                </div>
              </div>
              {organizer.bio && (
                <div className="mt-4 space-y-1">
                  <p className="text-sm text-muted-foreground">{t("users.bio")}</p>
                  <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-md border">{organizer.bio}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-6 mt-6">
          {loadingEvents ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : orgEvents.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">{t("orgDetail.noEvents")}</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("users.eventTitle")}</TableHead>
                      <TableHead>{t("events.category")}</TableHead>
                      <TableHead>{t("common.date")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead>{t("events.spots")}</TableHead>
                      <TableHead>{t("orgDetail.fillRate")}</TableHead>
                      <TableHead>{t("orgDetail.attendanceRate")}</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orgEvents.map((event: any) => {
                      const isAnalyticsEvent = isAnalyticsEventStatus(event.status);
                      const fillRate = isAnalyticsEvent && event.spots_total > 0 ? ((event.spots_taken / event.spots_total) * 100).toFixed(0) : null;
                      const isPast = new Date(event.date) < new Date(new Date().setHours(0, 0, 0, 0));
                      const eventRegs = regsByEvent[event.id];
                      const attRate = eventRegs && eventRegs.total > 0 ? ((eventRegs.checkedIn / eventRegs.total) * 100).toFixed(0) : null;

                      return (
                        <TableRow
                          key={event.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/events?search=${encodeURIComponent(event.title)}`)}
                        >
                          <TableCell className="font-medium">{event.title}</TableCell>
                          <TableCell>
                            {event.event_categories ? (
                              <span className="text-sm">{event.event_categories.icon} {event.event_categories.name}</span>
                            ) : <span className="text-muted-foreground text-sm">—</span>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{new Date(event.date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge variant={
                              event.status === "published" || event.status === "available" || event.status === "open" ? "default" :
                              event.status === "cancelled" ? "destructive" : "secondary"
                            }>
                              {event.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{event.spots_taken}/{event.spots_total}</TableCell>
                          <TableCell>{fillRate ? `${fillRate}%` : "—"}</TableCell>
                          <TableCell>{isAnalyticsEvent && isPast && attRate ? `${attRate}%` : "—"}</TableCell>
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-6 mt-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <PerfCard label={t("orgDetail.eventsCreated")} value={String(totalEvents)} />
            <PerfCard label={t("orgDetail.avgFillRate")} value={`${avgFillRate}%`} />
            <PerfCard label={t("orgDetail.avgAttendance")} value={`${avgAttendance}%`} />
            <PerfCard label={t("orgDetail.cancellationRate")} value={`${cancellationRate}%`} />
            <PerfCard label={t("orgDetail.noShowRate")} value={`${noShowRate}%`} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function PerfCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <div className="text-2xl font-bold text-primary">{value}</div>
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}
