import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, ArrowLeft, Instagram, Landmark, Car, Target, Activity, TrendingUp, Calendar, MapPin, ChevronRight, Gamepad2, Pill, ShieldCheck, CreditCard } from "lucide-react";
import { UserGamificationSection } from "@/components/gamification/UserGamificationSection";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { formatMembershipId } from "@/lib/membership";
import { instagramProfileUrl } from "@/lib/instagram";

type UserPaymentTransaction = {
  id: string;
  event_id: string | null;
  kind: "payment" | "refund";
  source: string;
  amount: number | string;
  event_amount: number | string | null;
  service_fee_amount: number | string | null;
  membership_fee_amount: number | string | null;
  created_at: string;
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  events?: { title?: string | null; date?: string | null } | null;
};

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const money = (value: unknown) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};
const formatEuro = (value: unknown) => euro.format(money(value));

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

  const { data: userActivity = [], isLoading: loadingActivity } = useQuery({
    queryKey: ["user-detail-activity", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("event_registrations")
        .select(`
          id, status, checked_in, created_at, sport_level,
          events:event_id (
            id, title, date, status,
            event_categories:category_id ( name, icon )
          )
        `)
        .eq("user_id", id)
        .or("sport_level.is.null,sport_level.not.like.manual:%")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: userPayments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["user-detail-payments", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("user_payment_transactions")
        .select("id, kind, source, amount, event_amount, service_fee_amount, membership_fee_amount, event_id, created_at, stripe_payment_intent_id, stripe_refund_id")
        .eq("user_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const eventIds = [...new Set((data || []).map((payment) => payment.event_id).filter(Boolean))] as string[];
      const { data: events } = eventIds.length > 0
        ? await supabase.from("events").select("id, title, date").in("id", eventIds)
        : { data: [] };
      const eventMap = new Map((events || []).map((event) => [event.id, event]));

      return (data || []).map((payment) => ({
        ...payment,
        kind: payment.kind === "refund" ? "refund" : "payment",
        events: payment.event_id ? eventMap.get(payment.event_id) || null : null,
      })) as UserPaymentTransaction[];
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
  const paymentGross = userPayments
    .filter((payment) => payment.kind === "payment")
    .reduce((sum, payment) => sum + money(payment.amount), 0);
  const paymentRefunds = userPayments
    .filter((payment) => payment.kind === "refund")
    .reduce((sum, payment) => sum + money(payment.amount), 0);
  const paymentNet = paymentGross - paymentRefunds;
  const membershipSpend = userPayments
    .filter((payment) => payment.kind === "payment")
    .reduce((sum, payment) => sum + money(payment.membership_fee_amount), 0);

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
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="profile">{t("users.profileOverview")}</TabsTrigger>
          <TabsTrigger value="activity">{t("users.activityHistory")}</TabsTrigger>
          <TabsTrigger value="payments" className="gap-1"><CreditCard className="h-3.5 w-3.5" /> Pagamenti</TabsTrigger>
          <TabsTrigger value="gamification" className="gap-1"><Gamepad2 className="h-3.5 w-3.5" /> Gamification</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 mt-6">
          {/* Basic Info */}
          <Card>
            <CardHeader><CardTitle className="text-lg">{t("users.personalInfo")}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <InfoField label={t("common.email")} value={user.email} />
                <InfoField label={t("common.phone")} value={user.phone || "—"} />
                <InstagramField handle={user.instagram_handle} />
                <InfoField label={t("users.joinedDate")} value={new Date(user.created_at).toLocaleDateString()} />
                <InfoField label={t("users.lastLogin")} value={user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : t("users.never")} />
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t("users.membershipStatus")}</p>
                  <Badge variant={user.membership_status === "Active" ? "outline" : "secondary"}>
                    {user.membership_status || "None"}
                  </Badge>
                </div>
                {user.membership_id && (
                  <InfoField label={t("users.membershipId")} value={formatMembershipId(user.membership_id)} mono />
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

	          <Card>
	            <CardHeader><CardTitle className="text-lg">Salute e sicurezza</CardTitle></CardHeader>
	            <CardContent className="space-y-4">
	              <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-4">
	                {user.health_safety_status === "has_info" ? (
	                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
	                ) : (
	                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
	                )}
	                <div className="min-w-0 flex-1 space-y-1">
	                  <p className="font-semibold">{getHealthSafetyLabel(user.health_safety_status)}</p>
	                  <p className="text-sm text-muted-foreground">
	                    Visibile solo ad admin/staff e agli organizzatori degli eventi dell'utente. Non influenza fit score, suggerimenti o blocchi.
	                  </p>
	                </div>
	              </div>

	              {user.health_safety_status === "has_info" && (
	                <div className="grid gap-4 md:grid-cols-2">
	                  <HealthInfoBlock label="Informazioni utili" value={user.health_safety_notes} />
	                  <div className="space-y-2 rounded-md border bg-muted/20 p-3">
	                    <p className="text-sm text-muted-foreground">Farmaci o dispositivi</p>
	                    <div className="flex items-start gap-2">
	                      <Pill className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
	                      <p className="text-sm font-medium whitespace-pre-wrap">
	                        {user.emergency_medication_has ? user.emergency_medication_notes || "Si, dettaglio non indicato" : "No"}
	                      </p>
	                    </div>
	                  </div>
	                  <HealthInfoBlock label="Indicazioni operative" value={user.health_safety_help_notes} />
	                  <InfoField
	                    label="Ultimo aggiornamento"
	                    value={user.health_safety_updated_at ? new Date(user.health_safety_updated_at).toLocaleString() : "—"}
	                  />
	                </div>
	              )}
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
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="payments" className="space-y-6 mt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Spesa lorda" value={formatEuro(paymentGross)} color="primary" />
            <MetricCard label="Rimborsi" value={formatEuro(paymentRefunds)} color="warning" />
            <MetricCard label="Spesa netta" value={formatEuro(paymentNet)} color="success" />
            <MetricCard label="Quote tessera" value={formatEuro(membershipSpend)} color="primary" />
          </div>

          {loadingPayments ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : userPayments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nessun pagamento Stripe registrato.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Origine</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Importo</TableHead>
                      <TableHead>Componenti</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="text-sm whitespace-nowrap">{new Date(payment.created_at).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={payment.kind === "payment" ? "default" : "secondary"}>
                            {payment.kind === "payment" ? "Pagamento" : "Rimborso"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{paymentSourceLabel(payment.source)}</TableCell>
                        <TableCell className="text-sm">
                          {payment.events?.title ? (
                            <div>
                              <p className="font-medium">{payment.events.title}</p>
                              {payment.events.date && <p className="text-xs text-muted-foreground">{new Date(payment.events.date).toLocaleDateString()}</p>}
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="font-medium tabular-nums">{formatEuro(payment.amount)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {payment.kind === "payment" ? (
                            <div className="space-y-0.5">
                              <p>Evento {formatEuro(payment.event_amount)}</p>
                              <p>Servizio {formatEuro(payment.service_fee_amount)}</p>
                              <p>Tessera {formatEuro(payment.membership_fee_amount)}</p>
                            </div>
                          ) : (
                            <span>{payment.stripe_refund_id || payment.stripe_payment_intent_id || "—"}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="gamification" className="mt-6">
          <UserGamificationSection
            userId={user.id}
            userName={`${user.first_name} ${user.last_name}`}
            totalPoints={user.total_points || 0}
            avatarUrl={user.avatar_url}
            firstName={user.first_name}
            lastName={user.last_name}
          />
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

function InstagramField({ handle }: { handle?: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">Instagram</p>
      {handle ? (
        <a
          href={instagramProfileUrl(handle)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <Instagram className="h-4 w-4" />
          @{handle}
        </a>
      ) : (
        <p className="font-medium">—</p>
      )}
    </div>
  );
}

function getHealthSafetyLabel(status?: string | null) {
  if (status === "none") return "Nessuna informazione da segnalare";
  if (status === "has_info") return "Informazioni da leggere";
  return "Non ancora compilato";
}

function paymentSourceLabel(source: string) {
  const labels: Record<string, string> = {
    event_checkout: "Evento",
    event_balance_checkout: "Saldo evento",
    membership_checkout: "Tessera",
    registration_change: "Cambio formula",
    event_cancellation_refund: "Rimborso cancellazione",
    event_cancelled_refund: "Rimborso evento annullato",
    event_checkout_auto_refund: "Rimborso automatico",
    legacy_event_registration: "Evento storico",
    legacy_event_refund: "Rimborso storico",
  };
  return labels[source] || source;
}

function HealthInfoBlock({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium whitespace-pre-wrap">{value || "—"}</p>
    </div>
  );
}

const metricStyles: Record<string, { card: string; text: string }> = {
  primary: { card: "bg-primary/5 border-primary/20", text: "text-primary" },
  success: { card: "bg-green-500/5 border-green-500/20", text: "text-green-600" },
  warning: { card: "bg-yellow-500/5 border-yellow-500/20", text: "text-yellow-600" },
  destructive: { card: "bg-destructive/5 border-destructive/20", text: "text-destructive" },
};

function MetricCard({ label, value, color }: { label: string; value: number | string; color: string }) {
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
