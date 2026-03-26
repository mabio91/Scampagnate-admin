import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Landmark, Car, Target, Activity, TrendingUp, Calendar, MapPin, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const { data: user, isLoading: loadingUser } = useQuery({
    queryKey: ["user-detail", id],
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
      } catch {}
      return {
        ...profile,
        roles: (roles || []).map((r) => r.role),
        email: authUser?.email || profile.email || "—",
        last_sign_in_at: authUser?.last_sign_in_at || null,
      };
    },
    enabled: !!id,
  });

  const { data: userActivity = [], isLoading: loadingActivity } = useQuery({
    queryKey: ["user-detail-activity", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("event_registrations")
        .select(`
          id, status, checked_in, created_at,
          events:event_id (
            id, title, date, status,
            event_categories:category_id ( name, icon )
          )
        `)
        .eq("user_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  if (loadingUser) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/users")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Button>
        <p className="text-muted-foreground">{t("common.noResults")}</p>
      </div>
    );
  }

  const joinedCount = userActivity.filter((a: any) => a.status === "registered" || a.status === "paid").length;
  const attendedCount = userActivity.filter((a: any) => a.checked_in).length;
  const waitlistCount = userActivity.filter((a: any) => a.status === "waitlist").length;
  const cancelledCount = userActivity.filter((a: any) => a.status === "cancelled").length;
  const noShowCount = userActivity.filter((a: any) => {
    const eventDate = (a as any).events?.date;
    const isPast = eventDate ? new Date(eventDate) < new Date(new Date().setHours(0, 0, 0, 0)) : false;
    return isPast && !a.checked_in && (a.status === "registered" || a.status === "paid");
  }).length;

  const lastAttended = userActivity
    .filter((a: any) => a.checked_in && (a as any).events?.date)
    .sort((a: any, b: any) => new Date((b as any).events.date).getTime() - new Date((a as any).events.date).getTime())[0];

  // Participation streak
  const attendedEvents = userActivity
    .filter((a: any) => a.checked_in && (a as any).events?.date)
    .sort((a: any, b: any) => new Date((b as any).events.date).getTime() - new Date((a as any).events.date).getTime());
  
  let streak = 0;
  const pastRegistered = userActivity
    .filter((a: any) => {
      const d = (a as any).events?.date;
      return d && new Date(d) < new Date(new Date().setHours(0, 0, 0, 0)) && (a.status === "registered" || a.status === "paid");
    })
    .sort((a: any, b: any) => new Date((b as any).events.date).getTime() - new Date((a as any).events.date).getTime());
  
  for (const ev of pastRegistered) {
    if ((ev as any).checked_in) streak++;
    else break;
  }

  const interestsArr = user.interests || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/users")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{user.first_name} {user.last_name}</h1>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex gap-2 ml-auto">
          {user.roles.map((r: string) => (
            <Badge key={r} variant={r === "admin" ? "default" : r === "organizer" ? "secondary" : "outline"}>{r}</Badge>
          ))}
          <Badge
            variant={user.account_status === "Active" ? "outline" : "default"}
            className={
              user.account_status === "Active" ? "bg-green-500/10 text-green-500" :
              user.account_status === "Suspended" ? "bg-yellow-500 text-yellow-950" :
              "bg-destructive text-destructive-foreground"
            }
          >
            {user.account_status || "Active"}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="profile">{t("users.profileOverview")}</TabsTrigger>
          <TabsTrigger value="activity">{t("users.activityHistory")}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 mt-6">
          {/* Basic Info */}
          <Card>
            <CardHeader><CardTitle className="text-lg">{t("users.personalInfo")}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <InfoField label={t("common.email")} value={user.email} />
                <InfoField label={t("common.phone")} value={user.phone || "—"} />
                <InfoField label={t("users.joinedDate")} value={new Date(user.created_at).toLocaleDateString()} />
                <InfoField label={t("users.lastLogin")} value={user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : t("users.never")} />
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t("users.membershipStatus")}</p>
                  <Badge variant={user.membership_status === "Active" ? "outline" : "secondary"}>
                    {user.membership_status || "None"}
                  </Badge>
                </div>
                {user.membership_id && (
                  <InfoField label={t("users.membershipId")} value={String(user.membership_id)} mono />
                )}
              </div>
              {user.is_founding_member && (
                <div className="mt-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-amber-600" />
                    <span className="font-semibold text-amber-600">{t("users.foundingMember")}</span>
                  </div>
                </div>
              )}
              {user.bio && (
                <div className="mt-4 space-y-1">
                  <p className="text-sm text-muted-foreground">{t("users.bio")}</p>
                  <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-md border">{user.bio}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Onboarding / Profile Data */}
          <Card>
            <CardHeader><CardTitle className="text-lg">{t("userDetail.onboardingData")}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t("userDetail.selfLevel")}</p>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <p className="font-medium">{user.self_level || "—"}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t("userDetail.experienceCount")}</p>
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <p className="font-medium">{attendedCount}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t("userDetail.activityFrequency")}</p>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <p className="font-medium">{user.activity_frequency || "—"}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t("userDetail.hasCar")}</p>
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-primary" />
                    <p className="font-medium">{user.has_car || "—"}</p>
                  </div>
                </div>
                <div className="space-y-1 col-span-2">
                  <p className="text-sm text-muted-foreground">{t("userDetail.interests")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {interestsArr.length > 0 ? interestsArr.map((interest: string) => (
                      <Badge key={interest} variant="secondary" className="text-xs">{interest}</Badge>
                    )) : <span className="text-muted-foreground text-sm">—</span>}
                  </div>
                </div>
                {user.event_motivation && (
                  <div className="space-y-1 col-span-full">
                    <p className="text-sm text-muted-foreground">{t("userDetail.eventMotivation")}</p>
                    <p className="text-sm bg-muted/30 p-3 rounded-md border">{user.event_motivation}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6 mt-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard label={t("userDetail.joined")} value={joinedCount} color="primary" />
            <MetricCard label={t("userDetail.attended")} value={attendedCount} color="success" />
            <MetricCard label={t("userDetail.waitlist")} value={waitlistCount} color="warning" />
            <MetricCard label={t("userDetail.cancelled")} value={cancelledCount} color="destructive" />
            <MetricCard label={t("userDetail.noShow")} value={noShowCount} color="destructive" />
            <MetricCard label={t("userDetail.streak")} value={streak} color="primary" />
          </div>

          {/* Last attended & average fit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-1">{t("userDetail.lastAttended")}</p>
                {lastAttended ? (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{(lastAttended as any).events?.title}</span>
                    <span className="text-sm text-muted-foreground">
                      ({new Date((lastAttended as any).events?.date).toLocaleDateString()})
                    </span>
                  </div>
                ) : <span className="text-muted-foreground text-sm">—</span>}
              </CardContent>
            </Card>
          </div>

          {/* Activity table */}
          {loadingActivity ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : userActivity.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {t("users.noActivity")}
              </CardContent>
            </Card>
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
                      <TableHead>{t("profile.attendance")}</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userActivity.map((activity: any) => {
                      const ev = activity.events;
                      const eventDate = ev?.date;
                      const isPast = eventDate ? new Date(eventDate) < new Date(new Date().setHours(0, 0, 0, 0)) : false;
                      const isNoShow = isPast && !activity.checked_in && (activity.status === "registered" || activity.status === "paid");
                      const category = ev?.event_categories;

                      return (
                        <TableRow
                          key={activity.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => ev?.id && navigate(`/events?search=${encodeURIComponent(ev.title)}`)}
                        >
                          <TableCell className="font-medium">{ev?.title || "—"}</TableCell>
                          <TableCell>
                            {category ? (
                              <span className="text-sm">{category.icon} {category.name}</span>
                            ) : <span className="text-muted-foreground text-sm">—</span>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{eventDate ? new Date(eventDate).toLocaleDateString() : "—"}</TableCell>
                          <TableCell>
                            <Badge variant={
                              activity.status === "registered" || activity.status === "paid" ? "default" :
                              activity.status === "waitlist" ? "secondary" : "outline"
                            }>
                              {activity.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {activity.checked_in ? (
                              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">{t("profile.present")}</Badge>
                            ) : isNoShow ? (
                              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">{t("profile.noShow")}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`font-medium ${mono ? "font-mono text-sm" : ""}`}>{value}</p>
    </div>
  );
}

const metricStyles: Record<string, { card: string; text: string }> = {
  primary: { card: "bg-primary/5 border-primary/20", text: "text-primary" },
  success: { card: "bg-green-500/5 border-green-500/20", text: "text-green-600" },
  warning: { card: "bg-yellow-500/5 border-yellow-500/20", text: "text-yellow-600" },
  destructive: { card: "bg-destructive/5 border-destructive/20", text: "text-destructive" },
};

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  const style = metricStyles[color] || metricStyles.primary;
  return (
    <Card className={style.card}>
      <CardContent className="p-4 text-center">
        <div className={`text-2xl font-bold ${style.text}`}>{value}</div>
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</div>
      </CardContent>
    </Card>
  );
}
