import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, differenceInHours, subMonths, startOfMonth } from "date-fns";
import type { DashboardFilterValues } from "./DashboardFilters";

export type KPIType =
  | "total-users"
  | "active-members"
  | "participating-users"
  | "events-created"
  | "participation-rate"
  | "attendance-rate"
  | "fill-rate"
  | "waitlist"
  | "repeat-participants"
  | "top-category"
  | "open-issues"
  | "community-health"
  | null;

export const KPI_META: Record<string, { title: string; titleIt: string; description: string; descriptionIt: string }> = {
  "total-users": { title: "Total Users", titleIt: "Utenti Totali", description: "All registered users on the platform", descriptionIt: "Tutti gli utenti registrati sulla piattaforma" },
  "active-members": { title: "Active Memberships", titleIt: "Tesserati Attivi", description: "Members with active paid membership", descriptionIt: "Membri con tessera attiva pagata" },
  "participating-users": { title: "Participating Users", titleIt: "Utenti Partecipanti", description: "Users who attended at least one event", descriptionIt: "Utenti che hanno partecipato ad almeno un evento" },
  "events-created": { title: "Events Created", titleIt: "Eventi Creati", description: "All events on the platform", descriptionIt: "Tutti gli eventi sulla piattaforma" },
  "participation-rate": { title: "Participation Rate", titleIt: "Tasso Partecipazione", description: "Users with ≥1 registration / Total users", descriptionIt: "Utenti con ≥1 iscrizione / Utenti totali" },
  "attendance-rate": { title: "Attendance Rate", titleIt: "Tasso Presenza", description: "Check-ins / Total registrations", descriptionIt: "Check-in / Iscrizioni totali" },
  "fill-rate": { title: "Fill Rate", titleIt: "Tasso Riempimento", description: "Registrations / Event capacity", descriptionIt: "Iscrizioni / Capacità evento" },
  "waitlist": { title: "Waitlist", titleIt: "Lista d'Attesa", description: "Events with waitlisted users", descriptionIt: "Eventi con utenti in lista d'attesa" },
  "repeat-participants": { title: "Frequent Participants", titleIt: "Partecipanti Abituali", description: "Users who attended >3 events", descriptionIt: "Utenti che hanno partecipato a >3 eventi" },
  "top-category": { title: "Categories Ranking", titleIt: "Classifica Categorie", description: "Categories ranked by events and registrations", descriptionIt: "Categorie ordinate per eventi e iscrizioni" },
  "open-issues": { title: "Open Issues", titleIt: "Segnalazioni Aperte", description: "Reported issues and their status", descriptionIt: "Segnalazioni riportate e il loro stato" },
  "community-health": { title: "Community Health", titleIt: "Salute Community", description: "Overall community health breakdown", descriptionIt: "Panoramica della salute della community" },
};

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    Active: "bg-success/10 text-success border-success/20",
    Suspended: "bg-warning/10 text-warning border-warning/20",
    Banned: "bg-destructive/10 text-destructive border-destructive/20",
    Inactive: "bg-muted text-muted-foreground",
    open: "bg-destructive/10 text-destructive border-destructive/20",
    in_progress: "bg-warning/10 text-warning border-warning/20",
    resolved: "bg-success/10 text-success border-success/20",
    high: "bg-destructive/10 text-destructive",
    medium: "bg-warning/10 text-warning",
    low: "bg-muted text-muted-foreground",
    available: "bg-success/10 text-success",
    published: "bg-success/10 text-success",
    draft: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/10 text-destructive",
    full: "bg-warning/10 text-warning",
    past: "bg-muted text-muted-foreground",
    closed: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={colors[status] || ""}>{status}</Badge>;
}

function LoadingSkeleton() {
  return <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
}

function MiniStat({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-muted/50 border p-4">
      <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
      <p className={`text-xl font-bold ${color || "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function FormulaBox({ formula, description }: { formula: string; description?: string }) {
  return (
    <div className="rounded-lg bg-muted/50 border p-4 text-sm">
      <p className="text-xs font-semibold text-muted-foreground mb-1">📐 Formula</p>
      <p className="font-mono text-foreground">{formula}</p>
      {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-sm font-semibold text-foreground mt-2">{children}</h4>;
}

function HealthMetric({ label, value, good, warn }: { label: string; value: string; good: boolean; warn: boolean }) {
  const color = good ? "text-success" : warn ? "text-warning" : "text-destructive";
  return (
    <div className="rounded-lg border p-4 bg-card">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground text-center py-8">{message}</p>;
}

/* ═══════════════════════════════════════════════════════════
   1. TOTAL USERS
   ═══════════════════════════════════════════════════════════ */

function TotalUsersDetail({ filters }: { filters: DashboardFilterValues }) {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-users-full", filters],
    queryFn: async () => {
      let q = supabase.from("profiles").select("id, first_name, last_name, email, phone, account_status, membership_status, membership_year, is_founding_member, onboarding_completed, created_at, total_points, self_level, trekking_experience, activity_frequency, has_car");
      if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom.toISOString());
      if (filters.dateTo) q = q.lte("created_at", filters.dateTo.toISOString());
      const { data: users } = await q.order("created_at", { ascending: false }).limit(500);

      // Get roles
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleMap: Record<string, string[]> = {};
      roles?.forEach(r => {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id].push(r.role);
      });

      // Monthly registration trend (last 6 months)
      const monthlyTrend: { month: string; count: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const mStart = format(startOfMonth(d), "yyyy-MM-dd'T'HH:mm:ss");
        const mEnd = format(startOfMonth(subMonths(d, -1)), "yyyy-MM-dd'T'HH:mm:ss");
        monthlyTrend.push({
          month: format(d, "MMM yyyy"),
          count: (users || []).filter(u => u.created_at >= mStart && u.created_at < mEnd).length,
        });
      }

      return { users: users || [], roleMap, monthlyTrend };
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  const users = data?.users || [];
  const total = users.length;
  const active = users.filter(u => u.account_status === "Active").length;
  const suspended = users.filter(u => u.account_status === "Suspended").length;
  const banned = users.filter(u => u.account_status === "Banned").length;
  const onboarded = users.filter(u => u.onboarding_completed).length;
  const withPhone = users.filter(u => u.phone && u.phone.length > 0).length;
  const withEmail = users.filter(u => u.email && u.email.length > 0).length;
  const admins = Object.values(data?.roleMap || {}).filter(r => r.includes("admin")).length;
  const organizers = Object.values(data?.roleMap || {}).filter(r => r.includes("organizer")).length;
  const founders = users.filter(u => u.is_founding_member).length;
  const withCar = users.filter(u => u.has_car === "yes").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MiniStat label="Totale utenti" value={total} />
        <MiniStat label="Attivi" value={active} color="text-success" />
        <MiniStat label="Sospesi" value={suspended} color="text-warning" />
        <MiniStat label="Banditi" value={banned} color="text-destructive" />
        <MiniStat label="Onboarding ✅" value={onboarded} sub={`${total > 0 ? Math.round((onboarded / total) * 100) : 0}%`} />
        <MiniStat label="Onboarding ❌" value={total - onboarded} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Admin" value={admins} color="text-primary" />
        <MiniStat label="Organizzatori" value={organizers} color="text-accent" />
        <MiniStat label="Fondatori" value={founders} color="text-warning" />
        <MiniStat label="Con auto" value={withCar} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MiniStat label="Con email" value={withEmail} sub={`${total > 0 ? Math.round((withEmail / total) * 100) : 0}%`} />
        <MiniStat label="Con telefono" value={withPhone} sub={`${total > 0 ? Math.round((withPhone / total) * 100) : 0}%`} />
      </div>

      <SectionTitle>📈 Trend registrazione mensile</SectionTitle>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {data?.monthlyTrend.map(m => (
          <div key={m.month} className="rounded-lg border p-3 text-center bg-card">
            <p className="text-[10px] text-muted-foreground">{m.month}</p>
            <p className="text-lg font-bold text-foreground">{m.count}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Tutti ({total})</TabsTrigger>
          <TabsTrigger value="active">Attivi ({active})</TabsTrigger>
          <TabsTrigger value="suspended">Sospesi ({suspended})</TabsTrigger>
          <TabsTrigger value="banned">Banditi ({banned})</TabsTrigger>
        </TabsList>
        {["all", "active", "suspended", "banned"].map(tab => (
          <TabsContent key={tab} value={tab}>
            <div className="rounded-xl border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefono</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Ruoli</TableHead>
                    <TableHead>Tessera</TableHead>
                    <TableHead>Punti</TableHead>
                    <TableHead>Livello</TableHead>
                    <TableHead>Onboarding</TableHead>
                    <TableHead>Iscritto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users
                    .filter(u => tab === "all" || (tab === "active" && u.account_status === "Active") || (tab === "suspended" && u.account_status === "Suspended") || (tab === "banned" && u.account_status === "Banned"))
                    .map(u => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium whitespace-nowrap">{u.first_name} {u.last_name}</TableCell>
                        <TableCell className="text-xs">{u.email || "—"}</TableCell>
                        <TableCell className="text-xs">{u.phone || "—"}</TableCell>
                        <TableCell>{statusBadge(u.account_status || "Active")}</TableCell>
                        <TableCell className="text-xs">{(data?.roleMap[u.id] || ["user"]).join(", ")}</TableCell>
                        <TableCell><Badge variant="outline">{u.membership_status || "Inactive"}</Badge></TableCell>
                        <TableCell>{u.total_points}</TableCell>
                        <TableCell className="text-xs">{u.self_level || "—"}</TableCell>
                        <TableCell>{u.onboarding_completed ? "✅" : "❌"}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{format(new Date(u.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   2. ACTIVE MEMBERSHIPS
   ═══════════════════════════════════════════════════════════ */

function ActiveMembersDetail({ filters }: { filters: DashboardFilterValues }) {
  const currentYear = new Date().getFullYear();
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-members-full", filters],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles")
        .select("id, first_name, last_name, email, membership_status, membership_year, membership_id, is_founding_member, membership_registration_date, account_status, created_at")
        .not("membership_id", "is", null)
        .order("membership_registration_date", { ascending: false }).limit(500);
      return profiles || [];
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  const members = data || [];
  const active = members.filter(m => m.membership_status === "Active" && m.membership_year === currentYear);
  const expired = members.filter(m => m.membership_status !== "Active" || (m.membership_year !== null && m.membership_year < currentYear));
  const founding = members.filter(m => m.is_founding_member);
  const byYear: Record<number, number> = {};
  members.forEach(m => { if (m.membership_year) byYear[m.membership_year] = (byYear[m.membership_year] || 0) + 1; });
  const yearEntries = Object.entries(byYear).sort((a, b) => Number(b[0]) - Number(a[0]));

  return (
    <div className="space-y-6">
      <FormulaBox formula={`Tesserati attivi = membership_status='Active' AND membership_year=${currentYear}`} description="Conta i profili con tessera attiva nell'anno corrente" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Attivi (anno corrente)" value={active.length} color="text-success" />
        <MiniStat label="Scaduti / Non attivi" value={expired.length} color="text-warning" />
        <MiniStat label="Fondatori" value={founding.length} color="text-accent" />
        <MiniStat label="Totale tessere emesse" value={members.length} />
      </div>

      <SectionTitle>📅 Distribuzione per anno</SectionTitle>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {yearEntries.map(([year, count]) => (
          <div key={year} className="rounded-lg border p-3 text-center bg-card">
            <p className="text-[10px] text-muted-foreground">{year}</p>
            <p className="text-lg font-bold">{count}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Attivi ({active.length})</TabsTrigger>
          <TabsTrigger value="expired">Scaduti ({expired.length})</TabsTrigger>
          <TabsTrigger value="founding">Fondatori ({founding.length})</TabsTrigger>
          <TabsTrigger value="all">Tutti ({members.length})</TabsTrigger>
        </TabsList>
        {[
          { key: "active", list: active },
          { key: "expired", list: expired },
          { key: "founding", list: founding },
          { key: "all", list: members },
        ].map(({ key, list }) => (
          <TabsContent key={key} value={key}>
            <div className="rounded-xl border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>ID Tessera</TableHead>
                    <TableHead>Anno</TableHead>
                    <TableHead>Stato tessera</TableHead>
                    <TableHead>Stato account</TableHead>
                    <TableHead>Fondatore</TableHead>
                    <TableHead>Data tessera</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium whitespace-nowrap">{m.first_name} {m.last_name}</TableCell>
                      <TableCell className="text-xs">{m.email || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{m.membership_id}</TableCell>
                      <TableCell>{m.membership_year || "—"}</TableCell>
                      <TableCell>{statusBadge(m.membership_status || "Inactive")}</TableCell>
                      <TableCell>{statusBadge(m.account_status || "Active")}</TableCell>
                      <TableCell>{m.is_founding_member ? "⭐ Sì" : "—"}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{m.membership_registration_date ? format(new Date(m.membership_registration_date), "dd/MM/yyyy") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   3. PARTICIPATING USERS
   ═══════════════════════════════════════════════════════════ */

function ParticipatingUsersDetail({ filters }: { filters: DashboardFilterValues }) {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-participating-full", filters],
    queryFn: async () => {
      let q = supabase.from("event_registrations").select("user_id, status, checked_in, created_at, event_id, events!inner(date, title, category_id)");
      if (filters.dateFrom) q = q.gte("events.date", format(filters.dateFrom, "yyyy-MM-dd"));
      if (filters.dateTo) q = q.lte("events.date", format(filters.dateTo, "yyyy-MM-dd"));
      if (filters.categoryId) q = q.eq("events.category_id", filters.categoryId);
      const { data: regs } = await q;
      if (!regs) return { users: [], totalRegs: 0, totalCheckedIn: 0, totalNoShows: 0, totalCancelled: 0 };

      const userMap: Record<string, { userId: string; eventsJoined: number; eventsAttended: number; lastEvent: string; lastDate: string; noShows: number; cancelled: number; firstDate: string }> = {};
      let totalRegs = 0, totalCheckedIn = 0, totalNoShows = 0, totalCancelled = 0;

      regs.forEach((r: any) => {
        if (!userMap[r.user_id]) userMap[r.user_id] = { userId: r.user_id, eventsJoined: 0, eventsAttended: 0, lastEvent: "", lastDate: "", noShows: 0, cancelled: 0, firstDate: r.events.date };
        const u = userMap[r.user_id];
        if (["registered", "paid", "attended"].includes(r.status)) { u.eventsJoined++; totalRegs++; }
        if (r.checked_in) { u.eventsAttended++; totalCheckedIn++; }
        if (r.status === "no_show") { u.noShows++; totalNoShows++; }
        if (r.status === "cancelled") { u.cancelled++; totalCancelled++; }
        if (!u.lastDate || r.events.date > u.lastDate) { u.lastDate = r.events.date; u.lastEvent = r.events.title; }
        if (r.events.date < u.firstDate) u.firstDate = r.events.date;
      });

      const userIds = Object.keys(userMap);
      if (userIds.length === 0) return { users: [], totalRegs, totalCheckedIn, totalNoShows, totalCancelled };

      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, membership_status, email").in("id", userIds.slice(0, 300));
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

      const users = Object.values(userMap)
        .filter(u => u.eventsJoined > 0)
        .sort((a, b) => b.eventsAttended - a.eventsAttended)
        .slice(0, 300)
        .map(u => ({
          ...u,
          name: profileMap[u.userId] ? `${profileMap[u.userId].first_name} ${profileMap[u.userId].last_name}` : u.userId.slice(0, 8),
          email: profileMap[u.userId]?.email || "—",
          membership: profileMap[u.userId]?.membership_status || "Inactive",
        }));

      return { users, totalRegs, totalCheckedIn, totalNoShows, totalCancelled };
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <FormulaBox formula="Utenti partecipanti = utenti con almeno 1 iscrizione (status: registered/paid/attended)" />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <MiniStat label="Utenti partecipanti" value={data.users.length} color="text-primary" />
        <MiniStat label="Totale iscrizioni" value={data.totalRegs} />
        <MiniStat label="Totale check-in" value={data.totalCheckedIn} color="text-success" />
        <MiniStat label="Totale no-show" value={data.totalNoShows} color="text-destructive" />
        <MiniStat label="Totale cancellazioni" value={data.totalCancelled} color="text-warning" />
      </div>

      <SectionTitle>👥 Lista utenti partecipanti</SectionTitle>
      <div className="rounded-xl border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Eventi iscritti</TableHead>
              <TableHead>Presenze (check-in)</TableHead>
              <TableHead>No-show</TableHead>
              <TableHead>Cancellazioni</TableHead>
              <TableHead>Tessera</TableHead>
              <TableHead>Ultimo evento</TableHead>
              <TableHead>Data ultimo</TableHead>
              <TableHead>Data primo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.users.map((u, i) => (
              <TableRow key={i}>
                <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium whitespace-nowrap">{u.name}</TableCell>
                <TableCell className="text-xs">{u.email}</TableCell>
                <TableCell>{u.eventsJoined}</TableCell>
                <TableCell className="text-success font-semibold">{u.eventsAttended}</TableCell>
                <TableCell className={u.noShows > 0 ? "text-destructive font-semibold" : ""}>{u.noShows}</TableCell>
                <TableCell className={u.cancelled > 0 ? "text-warning" : ""}>{u.cancelled}</TableCell>
                <TableCell>{statusBadge(u.membership)}</TableCell>
                <TableCell className="text-xs max-w-[150px] truncate">{u.lastEvent}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{u.lastDate ? format(new Date(u.lastDate), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{u.firstDate ? format(new Date(u.firstDate), "dd/MM/yyyy") : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   4. EVENTS CREATED
   ═══════════════════════════════════════════════════════════ */

function EventsCreatedDetail({ filters }: { filters: DashboardFilterValues }) {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-events-full", filters],
    queryFn: async () => {
      let q = supabase.from("events").select("id, title, date, time, location, status, spots_total, spots_taken, reserved_spots, category_id, organizer_name, organizer_id, payment_type, price, deposit, difficulty, visibility, featured, created_at");
      if (filters.dateFrom) q = q.gte("date", format(filters.dateFrom, "yyyy-MM-dd"));
      if (filters.dateTo) q = q.lte("date", format(filters.dateTo, "yyyy-MM-dd"));
      if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
      if (filters.organizerId) q = q.eq("organizer_id", filters.organizerId);
      const { data: events } = await q.order("date", { ascending: false }).limit(500);

      const { data: cats } = await supabase.from("event_categories").select("id, name");
      const catMap = Object.fromEntries((cats || []).map(c => [c.id, c.name]));

      // Registrations count per event
      const eventIds = (events || []).map(e => e.id);
      const { data: regs } = await supabase.from("event_registrations").select("event_id, status, checked_in").in("event_id", eventIds.slice(0, 300));
      const regCountMap: Record<string, { total: number; checkedIn: number; waitlist: number; cancelled: number }> = {};
      regs?.forEach(r => {
        if (!regCountMap[r.event_id]) regCountMap[r.event_id] = { total: 0, checkedIn: 0, waitlist: 0, cancelled: 0 };
        if (["registered", "paid", "attended"].includes(r.status)) regCountMap[r.event_id].total++;
        if (r.checked_in) regCountMap[r.event_id].checkedIn++;
        if (r.status === "waitlist") regCountMap[r.event_id].waitlist++;
        if (r.status === "cancelled") regCountMap[r.event_id].cancelled++;
      });

      return { events: events || [], catMap, regCountMap };
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  const events = data?.events || [];
  const byStatus: Record<string, number> = {};
  const byPayment: Record<string, number> = {};
  events.forEach(e => {
    byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    byPayment[e.payment_type] = (byPayment[e.payment_type] || 0) + 1;
  });
  const totalCapacity = events.reduce((s, e) => s + e.spots_total, 0);
  const totalTaken = events.reduce((s, e) => s + e.spots_taken, 0);
  const featured = events.filter(e => e.featured).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Totale eventi" value={events.length} />
        <MiniStat label="Capacità totale" value={totalCapacity} />
        <MiniStat label="Posti occupati" value={totalTaken} />
        <MiniStat label="Riempimento medio" value={totalCapacity > 0 ? `${Math.round((totalTaken / totalCapacity) * 100)}%` : "0%"} color="text-success" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="In evidenza" value={featured} color="text-warning" />
        {Object.entries(byStatus).map(([status, count]) => (
          <MiniStat key={status} label={`Stato: ${status}`} value={count} />
        ))}
      </div>

      <SectionTitle>💳 Per tipo pagamento</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Object.entries(byPayment).map(([type, count]) => (
          <MiniStat key={type} label={type} value={count} />
        ))}
      </div>

      <SectionTitle>📋 Dettaglio eventi</SectionTitle>
      <div className="rounded-xl border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Evento</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Luogo</TableHead>
              <TableHead>Organizzatore</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Prezzo</TableHead>
              <TableHead>Difficoltà</TableHead>
              <TableHead>Capacità</TableHead>
              <TableHead>Iscritti</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead>Waitlist</TableHead>
              <TableHead>Riempimento</TableHead>
              <TableHead>Creato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map(e => {
              const rc = data?.regCountMap[e.id] || { total: 0, checkedIn: 0, waitlist: 0, cancelled: 0 };
              const fill = e.spots_total > 0 ? Math.round((e.spots_taken / e.spots_total) * 100) : 0;
              return (
                <TableRow key={e.id}>
                  <TableCell className="font-medium max-w-[180px] truncate">{e.title}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{format(new Date(e.date), "dd/MM/yyyy")}</TableCell>
                  <TableCell className="text-xs max-w-[120px] truncate">{e.location}</TableCell>
                  <TableCell className="text-xs">{e.organizer_name}</TableCell>
                  <TableCell className="text-xs">{data?.catMap[e.category_id] || "—"}</TableCell>
                  <TableCell>{statusBadge(e.status)}</TableCell>
                  <TableCell className="text-xs">{e.payment_type}</TableCell>
                  <TableCell className="text-xs">{e.payment_type === "free" ? "Gratis" : `€${e.price}`}</TableCell>
                  <TableCell className="text-xs">{e.difficulty || "—"}</TableCell>
                  <TableCell>{e.spots_total}</TableCell>
                  <TableCell>{rc.total}</TableCell>
                  <TableCell className="text-success">{rc.checkedIn}</TableCell>
                  <TableCell className={rc.waitlist > 0 ? "text-warning font-semibold" : ""}>{rc.waitlist}</TableCell>
                  <TableCell><span className={fill >= 80 ? "text-success font-bold" : fill >= 50 ? "text-warning" : "text-muted-foreground"}>{fill}%</span></TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{format(new Date(e.created_at), "dd/MM/yyyy")}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   5. PARTICIPATION RATE
   ═══════════════════════════════════════════════════════════ */

function ParticipationRateDetail({ filters }: { filters: DashboardFilterValues }) {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-participation-rate-full", filters],
    queryFn: async () => {
      const { count: totalUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      const { data: regs } = await supabase.from("event_registrations").select("user_id, created_at, events!inner(date, category_id, organizer_id, organizer_name)").in("status", ["registered", "paid", "attended"]);
      const { data: cats } = await supabase.from("event_categories").select("id, name");
      const catMap = Object.fromEntries((cats || []).map(c => [c.id, c.name]));

      const filtered = (regs || []).filter((r: any) => {
        if (filters.dateFrom && r.events.date < format(filters.dateFrom, "yyyy-MM-dd")) return false;
        if (filters.dateTo && r.events.date > format(filters.dateTo, "yyyy-MM-dd")) return false;
        if (filters.categoryId && r.events.category_id !== filters.categoryId) return false;
        if (filters.organizerId && r.events.organizer_id !== filters.organizerId) return false;
        return true;
      });

      const uniqueUsers = new Set(filtered.map((r: any) => r.user_id));

      // By category
      const byCat: Record<string, Set<string>> = {};
      filtered.forEach((r: any) => {
        const catName = catMap[r.events.category_id] || "Senza categoria";
        if (!byCat[catName]) byCat[catName] = new Set();
        byCat[catName].add(r.user_id);
      });

      // By organizer
      const byOrg: Record<string, Set<string>> = {};
      filtered.forEach((r: any) => {
        const orgName = r.events.organizer_name || "Sconosciuto";
        if (!byOrg[orgName]) byOrg[orgName] = new Set();
        byOrg[orgName].add(r.user_id);
      });

      // Monthly trend (last 6 months)
      const monthlyTrend: { month: string; users: number; rate: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const mStart = format(startOfMonth(d), "yyyy-MM-dd");
        const mEnd = format(startOfMonth(subMonths(d, -1)), "yyyy-MM-dd");
        const monthUsers = new Set(
          filtered.filter((r: any) => r.events.date >= mStart && r.events.date < mEnd).map((r: any) => r.user_id)
        );
        monthlyTrend.push({
          month: format(d, "MMM yyyy"),
          users: monthUsers.size,
          rate: (totalUsers || 0) > 0 ? `${Math.round((monthUsers.size / (totalUsers || 1)) * 100)}%` : "0%",
        });
      }

      return {
        totalUsers: totalUsers || 0,
        participatingUsers: uniqueUsers.size,
        rate: (totalUsers || 0) > 0 ? Math.round((uniqueUsers.size / (totalUsers || 1)) * 100) : 0,
        totalRegistrations: filtered.length,
        byCategory: Object.entries(byCat).map(([name, users]) => ({ name, count: users.size, pct: (totalUsers || 0) > 0 ? Math.round((users.size / (totalUsers || 1)) * 100) : 0 })).sort((a, b) => b.count - a.count),
        byOrganizer: Object.entries(byOrg).map(([name, users]) => ({ name, count: users.size })).sort((a, b) => b.count - a.count),
        monthlyTrend,
      };
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <FormulaBox
        formula={`Tasso partecipazione = Utenti con ≥1 iscrizione (${data.participatingUsers}) / Utenti totali (${data.totalUsers}) = ${data.rate}%`}
        description="Si contano solo le iscrizioni con status registered, paid o attended"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Utenti totali (denominatore)" value={data.totalUsers} />
        <MiniStat label="Utenti partecipanti (numeratore)" value={data.participatingUsers} color="text-primary" />
        <MiniStat label="Tasso partecipazione" value={`${data.rate}%`} color="text-success" />
        <MiniStat label="Iscrizioni totali" value={data.totalRegistrations} />
      </div>

      <SectionTitle>📈 Trend mensile</SectionTitle>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {data.monthlyTrend.map(m => (
          <div key={m.month} className="rounded-lg border p-3 text-center bg-card">
            <p className="text-[10px] text-muted-foreground">{m.month}</p>
            <p className="text-lg font-bold">{m.users}</p>
            <p className="text-[10px] text-muted-foreground">{m.rate}</p>
          </div>
        ))}
      </div>

      <SectionTitle>📂 Per categoria</SectionTitle>
      <div className="rounded-xl border overflow-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Utenti unici</TableHead><TableHead>% su totale utenti</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.byCategory.map(c => (
              <TableRow key={c.name}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="font-semibold">{c.count}</TableCell>
                <TableCell>{c.pct}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <SectionTitle>👤 Per organizzatore</SectionTitle>
      <div className="rounded-xl border overflow-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Organizzatore</TableHead><TableHead>Utenti unici</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.byOrganizer.map(o => (
              <TableRow key={o.name}>
                <TableCell className="font-medium">{o.name}</TableCell>
                <TableCell className="font-semibold">{o.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   6. ATTENDANCE RATE
   ═══════════════════════════════════════════════════════════ */

function AttendanceRateDetail({ filters }: { filters: DashboardFilterValues }) {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-attendance-rate-full", filters],
    queryFn: async () => {
      const { data: regs } = await supabase.from("event_registrations")
        .select("status, checked_in, user_id, events!inner(id, title, date, category_id, organizer_id, organizer_name)")
        .in("status", ["registered", "paid", "attended", "no_show", "cancelled"]);
      const { data: cats } = await supabase.from("event_categories").select("id, name");
      const catMap = Object.fromEntries((cats || []).map(c => [c.id, c.name]));

      const filtered = (regs || []).filter((r: any) => {
        if (filters.dateFrom && r.events.date < format(filters.dateFrom, "yyyy-MM-dd")) return false;
        if (filters.dateTo && r.events.date > format(filters.dateTo, "yyyy-MM-dd")) return false;
        if (filters.categoryId && r.events.category_id !== filters.categoryId) return false;
        if (filters.organizerId && r.events.organizer_id !== filters.organizerId) return false;
        return true;
      });

      const totalRegs = filtered.filter(r => ["registered", "paid", "attended"].includes(r.status)).length;
      const checkedIn = filtered.filter(r => r.checked_in).length;
      const noShows = filtered.filter(r => r.status === "no_show").length;
      const cancelled = filtered.filter(r => r.status === "cancelled").length;

      // By event
      const eventMap: Record<string, { title: string; date: string; regs: number; checkedIn: number; noShows: number; cancelled: number; organizer: string; category: string }> = {};
      filtered.forEach((r: any) => {
        if (!eventMap[r.events.id]) eventMap[r.events.id] = { title: r.events.title, date: r.events.date, regs: 0, checkedIn: 0, noShows: 0, cancelled: 0, organizer: r.events.organizer_name, category: catMap[r.events.category_id] || "—" };
        if (["registered", "paid", "attended"].includes(r.status)) eventMap[r.events.id].regs++;
        if (r.checked_in) eventMap[r.events.id].checkedIn++;
        if (r.status === "no_show") eventMap[r.events.id].noShows++;
        if (r.status === "cancelled") eventMap[r.events.id].cancelled++;
      });

      // By category
      const byCat: Record<string, { regs: number; checkedIn: number }> = {};
      filtered.forEach((r: any) => {
        const catName = catMap[r.events.category_id] || "Senza categoria";
        if (!byCat[catName]) byCat[catName] = { regs: 0, checkedIn: 0 };
        if (["registered", "paid", "attended"].includes(r.status)) byCat[catName].regs++;
        if (r.checked_in) byCat[catName].checkedIn++;
      });

      // By organizer
      const byOrg: Record<string, { regs: number; checkedIn: number }> = {};
      filtered.forEach((r: any) => {
        const orgName = r.events.organizer_name || "Sconosciuto";
        if (!byOrg[orgName]) byOrg[orgName] = { regs: 0, checkedIn: 0 };
        if (["registered", "paid", "attended"].includes(r.status)) byOrg[orgName].regs++;
        if (r.checked_in) byOrg[orgName].checkedIn++;
      });

      return {
        totalRegs, checkedIn, noShows, cancelled,
        rate: totalRegs > 0 ? Math.round((checkedIn / totalRegs) * 100) : 0,
        noShowRate: totalRegs > 0 ? Math.round((noShows / totalRegs) * 100) : 0,
        cancellationRate: (totalRegs + cancelled) > 0 ? Math.round((cancelled / (totalRegs + cancelled)) * 100) : 0,
        byEvent: Object.values(eventMap).sort((a, b) => b.regs - a.regs),
        byCategory: Object.entries(byCat).map(([name, d]) => ({ name, ...d, rate: d.regs > 0 ? Math.round((d.checkedIn / d.regs) * 100) : 0 })).sort((a, b) => b.rate - a.rate),
        byOrganizer: Object.entries(byOrg).map(([name, d]) => ({ name, ...d, rate: d.regs > 0 ? Math.round((d.checkedIn / d.regs) * 100) : 0 })).sort((a, b) => b.rate - a.rate),
      };
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <FormulaBox
        formula={`Tasso presenza = Check-in (${data.checkedIn}) / Iscrizioni totali (${data.totalRegs}) = ${data.rate}%`}
        description="Si contano check-in effettivi rispetto alle iscrizioni confirmed (registered/paid/attended)"
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MiniStat label="Iscrizioni totali" value={data.totalRegs} />
        <MiniStat label="Check-in" value={data.checkedIn} color="text-success" />
        <MiniStat label="Tasso presenza" value={`${data.rate}%`} color="text-success" />
        <MiniStat label="No-show" value={data.noShows} color="text-destructive" sub={`${data.noShowRate}%`} />
        <MiniStat label="Cancellazioni" value={data.cancelled} color="text-warning" sub={`${data.cancellationRate}%`} />
        <MiniStat label="Presenza effettiva vs cancellazioni" value={`${data.rate}% vs ${data.cancellationRate}%`} />
      </div>

      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">Per evento ({data.byEvent.length})</TabsTrigger>
          <TabsTrigger value="categories">Per categoria ({data.byCategory.length})</TabsTrigger>
          <TabsTrigger value="organizers">Per organizzatore ({data.byOrganizer.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="events">
          <div className="rounded-xl border overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Evento</TableHead><TableHead>Data</TableHead><TableHead>Organizzatore</TableHead><TableHead>Categoria</TableHead><TableHead>Iscritti</TableHead><TableHead>Check-in</TableHead><TableHead>Tasso</TableHead><TableHead>No-show</TableHead><TableHead>Cancellati</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.byEvent.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium max-w-[180px] truncate">{e.title}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(e.date), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-xs">{e.organizer}</TableCell>
                    <TableCell className="text-xs">{e.category}</TableCell>
                    <TableCell>{e.regs}</TableCell>
                    <TableCell className="text-success">{e.checkedIn}</TableCell>
                    <TableCell className="font-semibold">{e.regs > 0 ? Math.round((e.checkedIn / e.regs) * 100) : 0}%</TableCell>
                    <TableCell className={e.noShows > 0 ? "text-destructive" : ""}>{e.noShows}</TableCell>
                    <TableCell className={e.cancelled > 0 ? "text-warning" : ""}>{e.cancelled}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="categories">
          <div className="rounded-xl border overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Iscrizioni</TableHead><TableHead>Check-in</TableHead><TableHead>Tasso presenza</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.byCategory.map(c => (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.regs}</TableCell>
                    <TableCell className="text-success">{c.checkedIn}</TableCell>
                    <TableCell className="font-semibold">{c.rate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="organizers">
          <div className="rounded-xl border overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Organizzatore</TableHead><TableHead>Iscrizioni</TableHead><TableHead>Check-in</TableHead><TableHead>Tasso presenza</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.byOrganizer.map(o => (
                  <TableRow key={o.name}>
                    <TableCell className="font-medium">{o.name}</TableCell>
                    <TableCell>{o.regs}</TableCell>
                    <TableCell className="text-success">{o.checkedIn}</TableCell>
                    <TableCell className="font-semibold">{o.rate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   7. FILL RATE
   ═══════════════════════════════════════════════════════════ */

function FillRateDetail({ filters }: { filters: DashboardFilterValues }) {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-fill-rate-full", filters],
    queryFn: async () => {
      let q = supabase.from("events").select("id, title, spots_total, spots_taken, category_id, organizer_name, date, status").gt("spots_total", 0);
      if (filters.dateFrom) q = q.gte("date", format(filters.dateFrom, "yyyy-MM-dd"));
      if (filters.dateTo) q = q.lte("date", format(filters.dateTo, "yyyy-MM-dd"));
      if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
      if (filters.organizerId) q = q.eq("organizer_id", filters.organizerId);
      const { data: events } = await q.order("date", { ascending: false }).limit(500);
      const { data: cats } = await supabase.from("event_categories").select("id, name");
      const catMap = Object.fromEntries((cats || []).map(c => [c.id, c.name]));

      const evts = (events || []).map(e => ({
        ...e,
        category: catMap[e.category_id] || "Senza categoria",
        fillRate: Math.round((e.spots_taken / e.spots_total) * 100),
      }));

      const totalCapacity = evts.reduce((s, e) => s + e.spots_total, 0);
      const totalTaken = evts.reduce((s, e) => s + e.spots_taken, 0);
      const avgFill = evts.length > 0 ? Math.round(evts.reduce((s, e) => s + e.fillRate, 0) / evts.length) : 0;
      const full = evts.filter(e => e.fillRate >= 100).length;
      const above80 = evts.filter(e => e.fillRate >= 80 && e.fillRate < 100).length;
      const below50 = evts.filter(e => e.fillRate < 50).length;

      // By category
      const byCat: Record<string, { events: number; capacity: number; taken: number }> = {};
      evts.forEach(e => {
        if (!byCat[e.category]) byCat[e.category] = { events: 0, capacity: 0, taken: 0 };
        byCat[e.category].events++;
        byCat[e.category].capacity += e.spots_total;
        byCat[e.category].taken += e.spots_taken;
      });

      // By organizer
      const byOrg: Record<string, { events: number; capacity: number; taken: number }> = {};
      evts.forEach(e => {
        if (!byOrg[e.organizer_name]) byOrg[e.organizer_name] = { events: 0, capacity: 0, taken: 0 };
        byOrg[e.organizer_name].events++;
        byOrg[e.organizer_name].capacity += e.spots_total;
        byOrg[e.organizer_name].taken += e.spots_taken;
      });

      return {
        events: evts, totalCapacity, totalTaken, avgFill, full, above80, below50,
        overallFill: totalCapacity > 0 ? Math.round((totalTaken / totalCapacity) * 100) : 0,
        byCategory: Object.entries(byCat).map(([name, d]) => ({ name, ...d, fill: d.capacity > 0 ? Math.round((d.taken / d.capacity) * 100) : 0 })).sort((a, b) => b.fill - a.fill),
        byOrganizer: Object.entries(byOrg).map(([name, d]) => ({ name, ...d, fill: d.capacity > 0 ? Math.round((d.taken / d.capacity) * 100) : 0 })).sort((a, b) => b.fill - a.fill),
      };
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <FormulaBox
        formula={`Tasso riempimento = Iscritti (${data.totalTaken}) / Capacità (${data.totalCapacity}) = ${data.overallFill}%`}
        description="Media riempimento per evento: ogni evento pesato uguale"
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MiniStat label="Totale eventi" value={data.events.length} />
        <MiniStat label="Capacità totale" value={data.totalCapacity} />
        <MiniStat label="Posti occupati" value={data.totalTaken} />
        <MiniStat label="Riempimento complessivo" value={`${data.overallFill}%`} color="text-primary" />
        <MiniStat label="Media per evento" value={`${data.avgFill}%`} />
        <MiniStat label="Pieni (100%)" value={data.full} color="text-success" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MiniStat label="≥80% riempimento" value={data.above80} color="text-success" />
        <MiniStat label="<50% riempimento" value={data.below50} color="text-destructive" />
      </div>

      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">Per evento</TabsTrigger>
          <TabsTrigger value="categories">Per categoria</TabsTrigger>
          <TabsTrigger value="organizers">Per organizzatore</TabsTrigger>
        </TabsList>
        <TabsContent value="events">
          <div className="rounded-xl border overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Evento</TableHead><TableHead>Data</TableHead><TableHead>Organizzatore</TableHead><TableHead>Categoria</TableHead><TableHead>Stato</TableHead><TableHead>Capacità</TableHead><TableHead>Iscritti</TableHead><TableHead>Riempimento</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.events.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium max-w-[180px] truncate">{e.title}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(e.date), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-xs">{e.organizer_name}</TableCell>
                    <TableCell className="text-xs">{e.category}</TableCell>
                    <TableCell>{statusBadge(e.status)}</TableCell>
                    <TableCell>{e.spots_total}</TableCell>
                    <TableCell>{e.spots_taken}</TableCell>
                    <TableCell><span className={e.fillRate >= 80 ? "text-success font-bold" : e.fillRate >= 50 ? "text-warning font-semibold" : "text-destructive"}>{e.fillRate}%</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="categories">
          <div className="rounded-xl border overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Eventi</TableHead><TableHead>Capacità</TableHead><TableHead>Iscritti</TableHead><TableHead>Riempimento</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.byCategory.map(c => (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.events}</TableCell>
                    <TableCell>{c.capacity}</TableCell>
                    <TableCell>{c.taken}</TableCell>
                    <TableCell className="font-semibold">{c.fill}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="organizers">
          <div className="rounded-xl border overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Organizzatore</TableHead><TableHead>Eventi</TableHead><TableHead>Capacità</TableHead><TableHead>Iscritti</TableHead><TableHead>Riempimento</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.byOrganizer.map(o => (
                  <TableRow key={o.name}>
                    <TableCell className="font-medium">{o.name}</TableCell>
                    <TableCell>{o.events}</TableCell>
                    <TableCell>{o.capacity}</TableCell>
                    <TableCell>{o.taken}</TableCell>
                    <TableCell className="font-semibold">{o.fill}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   8. WAITLIST
   ═══════════════════════════════════════════════════════════ */

function WaitlistDetail({ filters }: { filters: DashboardFilterValues }) {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-waitlist-full", filters],
    queryFn: async () => {
      // Get all registrations for waitlist analysis
      const { data: regs } = await supabase.from("event_registrations")
        .select("user_id, status, created_at, events!inner(id, title, date, spots_total, spots_taken, organizer_name, category_id)");

      const { data: cats } = await supabase.from("event_categories").select("id, name");
      const catMap = Object.fromEntries((cats || []).map(c => [c.id, c.name]));

      if (!regs) return { events: [], waitlistUsers: [], totalWaitlist: 0, totalPromoted: 0 };

      const filtered = regs.filter((r: any) => {
        if (filters.dateFrom && r.events.date < format(filters.dateFrom, "yyyy-MM-dd")) return false;
        if (filters.dateTo && r.events.date > format(filters.dateTo, "yyyy-MM-dd")) return false;
        if (filters.categoryId && r.events.category_id !== filters.categoryId) return false;
        return true;
      });

      const waitlistRegs = filtered.filter(r => r.status === "waitlist");
      const totalWaitlist = waitlistRegs.length;

      // Events with waitlist
      const eventMap: Record<string, { title: string; date: string; organizer: string; category: string; spotsTotal: number; spotsTaken: number; waitlistCount: number; registeredCount: number }> = {};
      filtered.forEach((r: any) => {
        if (!eventMap[r.events.id]) eventMap[r.events.id] = {
          title: r.events.title, date: r.events.date, organizer: r.events.organizer_name,
          category: catMap[r.events.category_id] || "—", spotsTotal: r.events.spots_total, spotsTaken: r.events.spots_taken,
          waitlistCount: 0, registeredCount: 0,
        };
        if (r.status === "waitlist") eventMap[r.events.id].waitlistCount++;
        if (["registered", "paid"].includes(r.status)) eventMap[r.events.id].registeredCount++;
      });

      const events = Object.values(eventMap).filter(e => e.waitlistCount > 0).sort((a, b) => b.waitlistCount - a.waitlistCount);

      // Waitlisted users
      const userIds = [...new Set(waitlistRegs.map(r => r.user_id))];
      let waitlistUsers: any[] = [];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, email").in("id", userIds.slice(0, 200));
        const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
        waitlistUsers = waitlistRegs.map((r: any) => ({
          name: profileMap[r.user_id] ? `${profileMap[r.user_id].first_name} ${profileMap[r.user_id].last_name}` : r.user_id.slice(0, 8),
          email: profileMap[r.user_id]?.email || "—",
          event: r.events.title,
          eventDate: r.events.date,
          addedAt: r.created_at,
        }));
      }

      return { events, waitlistUsers, totalWaitlist, totalPromoted: 0 };
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <FormulaBox formula="Lista d'attesa = Iscrizioni con status 'waitlist' per eventi filtrati" />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MiniStat label="Totale in lista d'attesa" value={data.totalWaitlist} color="text-warning" />
        <MiniStat label="Eventi con waitlist" value={data.events.length} />
        <MiniStat label="Utenti unici in attesa" value={data.waitlistUsers.length} />
      </div>

      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">Per evento ({data.events.length})</TabsTrigger>
          <TabsTrigger value="users">Utenti in attesa ({data.waitlistUsers.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="events">
          <div className="rounded-xl border overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Evento</TableHead><TableHead>Data</TableHead><TableHead>Organizzatore</TableHead><TableHead>Categoria</TableHead><TableHead>Capacità</TableHead><TableHead>Iscritti</TableHead><TableHead>In attesa</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.events.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium max-w-[180px] truncate">{e.title}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(e.date), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-xs">{e.organizer}</TableCell>
                    <TableCell className="text-xs">{e.category}</TableCell>
                    <TableCell>{e.spotsTotal}</TableCell>
                    <TableCell>{e.registeredCount}</TableCell>
                    <TableCell className="font-semibold text-warning">{e.waitlistCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="users">
          <div className="rounded-xl border overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Evento</TableHead><TableHead>Data evento</TableHead><TableHead>Aggiunto il</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.waitlistUsers.map((u, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium whitespace-nowrap">{u.name}</TableCell>
                    <TableCell className="text-xs">{u.email}</TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">{u.event}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(u.eventDate), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(u.addedAt), "dd/MM/yyyy HH:mm")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   9. FREQUENT PARTICIPANTS
   ═══════════════════════════════════════════════════════════ */

function RepeatParticipantsDetail({ filters }: { filters: DashboardFilterValues }) {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-repeat-full", filters],
    queryFn: async () => {
      const { data: regs } = await supabase.from("event_registrations")
        .select("user_id, checked_in, created_at, events!inner(date, title)")
        .eq("checked_in", true);
      if (!regs) return { users: [], threshold: 3 };

      const counts: Record<string, { count: number; lastDate: string; lastEvent: string; firstDate: string }> = {};
      (regs as any[]).forEach(r => {
        if (filters.dateFrom && r.events.date < format(filters.dateFrom, "yyyy-MM-dd")) return;
        if (filters.dateTo && r.events.date > format(filters.dateTo, "yyyy-MM-dd")) return;
        if (!counts[r.user_id]) counts[r.user_id] = { count: 0, lastDate: "", lastEvent: "", firstDate: r.events.date };
        counts[r.user_id].count++;
        if (!counts[r.user_id].lastDate || r.events.date > counts[r.user_id].lastDate) {
          counts[r.user_id].lastDate = r.events.date;
          counts[r.user_id].lastEvent = r.events.title;
        }
        if (r.events.date < counts[r.user_id].firstDate) counts[r.user_id].firstDate = r.events.date;
      });

      const frequentUserIds = Object.entries(counts).filter(([, d]) => d.count > 3).sort((a, b) => b[1].count - a[1].count);
      if (frequentUserIds.length === 0) return { users: [], threshold: 3 };

      const ids = frequentUserIds.map(([id]) => id).slice(0, 200);
      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, email, membership_status, total_points").in("id", ids);
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

      const { data: badges } = await supabase.from("user_badges").select("user_id, badge_id").in("user_id", ids);
      const badgeCount: Record<string, number> = {};
      badges?.forEach(b => { badgeCount[b.user_id] = (badgeCount[b.user_id] || 0) + 1; });

      return {
        users: frequentUserIds.map(([userId, d]) => ({
          name: profileMap[userId] ? `${profileMap[userId].first_name} ${profileMap[userId].last_name}` : userId.slice(0, 8),
          email: profileMap[userId]?.email || "—",
          eventsAttended: d.count,
          badges: badgeCount[userId] || 0,
          points: profileMap[userId]?.total_points || 0,
          membership: profileMap[userId]?.membership_status || "Inactive",
          lastEvent: d.lastEvent,
          lastDate: d.lastDate,
          firstDate: d.firstDate,
        })),
        threshold: 3,
      };
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!data) return null;

  const totalEvents = data.users.reduce((s, u) => s + u.eventsAttended, 0);
  const avgEvents = data.users.length > 0 ? Math.round(totalEvents / data.users.length) : 0;
  const maxEvents = data.users.length > 0 ? data.users[0].eventsAttended : 0;

  return (
    <div className="space-y-6">
      <FormulaBox
        formula={`Partecipanti abituali = utenti con check-in > ${data.threshold} eventi`}
        description="Soglia configurata: più di 3 eventi con check-in effettivo"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Partecipanti abituali" value={data.users.length} color="text-primary" />
        <MiniStat label="Media eventi per utente" value={avgEvents} />
        <MiniStat label="Max eventi singolo utente" value={maxEvents} color="text-success" />
        <MiniStat label="Totale presenze cumulate" value={totalEvents} />
      </div>

      <SectionTitle>🏆 Classifica partecipanti abituali</SectionTitle>
      <div className="rounded-xl border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Eventi</TableHead>
              <TableHead>Badge</TableHead>
              <TableHead>Punti</TableHead>
              <TableHead>Tessera</TableHead>
              <TableHead>Ultimo evento</TableHead>
              <TableHead>Ultima presenza</TableHead>
              <TableHead>Prima presenza</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.users.map((u, i) => (
              <TableRow key={i}>
                <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium whitespace-nowrap">{u.name}</TableCell>
                <TableCell className="text-xs">{u.email}</TableCell>
                <TableCell className="font-semibold text-primary">{u.eventsAttended}</TableCell>
                <TableCell>{u.badges > 0 ? `🏅 ${u.badges}` : "—"}</TableCell>
                <TableCell>{u.points}</TableCell>
                <TableCell>{statusBadge(u.membership)}</TableCell>
                <TableCell className="text-xs max-w-[150px] truncate">{u.lastEvent}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{u.lastDate ? format(new Date(u.lastDate), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{u.firstDate ? format(new Date(u.firstDate), "dd/MM/yyyy") : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   10. TOP CATEGORY
   ═══════════════════════════════════════════════════════════ */

function TopCategoryDetail({ filters }: { filters: DashboardFilterValues }) {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-top-category-full", filters],
    queryFn: async () => {
      const { data: cats } = await supabase.from("event_categories").select("id, name, icon, description");
      let eq = supabase.from("events").select("id, category_id, spots_total, spots_taken, date, title, organizer_name, status");
      if (filters.dateFrom) eq = eq.gte("date", format(filters.dateFrom, "yyyy-MM-dd"));
      if (filters.dateTo) eq = eq.lte("date", format(filters.dateTo, "yyyy-MM-dd"));
      const { data: events } = await eq;
      const { data: regs } = await supabase.from("event_registrations").select("event_id, checked_in, status, user_id").in("status", ["registered", "paid", "attended", "no_show"]);
      if (!cats || !events) return [];

      const eventIds = new Set(events.map(e => e.id));

      return cats.map(cat => {
        const catEvents = events.filter(e => e.category_id === cat.id);
        const catEventIds = new Set(catEvents.map(e => e.id));
        const catRegs = (regs || []).filter(r => catEventIds.has(r.event_id) && eventIds.has(r.event_id));
        const checkedIn = catRegs.filter(r => r.checked_in).length;
        const noShows = catRegs.filter(r => r.status === "no_show").length;
        const totalCapacity = catEvents.reduce((s, e) => s + (e.spots_total || 0), 0);
        const totalTaken = catEvents.reduce((s, e) => s + (e.spots_taken || 0), 0);
        const uniqueUsers = new Set(catRegs.map(r => r.user_id));
        const uniqueOrganizers = new Set(catEvents.map(e => e.organizer_name));
        const activeRegs = catRegs.filter(r => ["registered", "paid", "attended"].includes(r.status)).length;

        return {
          name: cat.name,
          icon: cat.icon,
          description: cat.description,
          events: catEvents.length,
          registrations: activeRegs,
          uniqueUsers: uniqueUsers.size,
          uniqueOrganizers: uniqueOrganizers.size,
          totalCapacity,
          totalTaken,
          fillRate: totalCapacity > 0 ? Math.round((totalTaken / totalCapacity) * 100) : 0,
          attendanceRate: activeRegs > 0 ? Math.round((checkedIn / activeRegs) * 100) : 0,
          noShows,
          noShowRate: activeRegs > 0 ? Math.round((noShows / activeRegs) * 100) : 0,
          avgEventsPerUser: uniqueUsers.size > 0 ? Math.round(activeRegs / uniqueUsers.size * 10) / 10 : 0,
        };
      }).sort((a, b) => b.events - a.events);
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!data || data.length === 0) return <EmptyState message="Nessuna categoria trovata" />;

  return (
    <div className="space-y-6">
      <SectionTitle>🏆 Classifica categorie</SectionTitle>
      <div className="rounded-xl border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Eventi</TableHead>
              <TableHead>Iscrizioni</TableHead>
              <TableHead>Utenti unici</TableHead>
              <TableHead>Organizzatori</TableHead>
              <TableHead>Capacità</TableHead>
              <TableHead>Riempimento</TableHead>
              <TableHead>Tasso presenza</TableHead>
              <TableHead>No-show</TableHead>
              <TableHead>Media eventi/utente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((c, i) => (
              <TableRow key={i}>
                <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium whitespace-nowrap">{c.icon} {c.name}</TableCell>
                <TableCell className="font-semibold">{c.events}</TableCell>
                <TableCell>{c.registrations}</TableCell>
                <TableCell>{c.uniqueUsers}</TableCell>
                <TableCell>{c.uniqueOrganizers}</TableCell>
                <TableCell>{c.totalCapacity}</TableCell>
                <TableCell><span className={c.fillRate >= 80 ? "text-success font-bold" : c.fillRate >= 50 ? "text-warning" : "text-muted-foreground"}>{c.fillRate}%</span></TableCell>
                <TableCell><span className={c.attendanceRate >= 70 ? "text-success font-bold" : c.attendanceRate >= 40 ? "text-warning" : "text-destructive"}>{c.attendanceRate}%</span></TableCell>
                <TableCell className={c.noShows > 0 ? "text-destructive" : ""}>{c.noShows} ({c.noShowRate}%)</TableCell>
                <TableCell>{c.avgEventsPerUser}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <SectionTitle>📊 Dettaglio per categoria</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {data.filter(c => c.events > 0).map(c => (
          <Card key={c.name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{c.icon} {c.name}</CardTitle>
              {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Eventi:</span> <strong>{c.events}</strong></div>
              <div><span className="text-muted-foreground">Iscrizioni:</span> <strong>{c.registrations}</strong></div>
              <div><span className="text-muted-foreground">Utenti unici:</span> <strong>{c.uniqueUsers}</strong></div>
              <div><span className="text-muted-foreground">Riempimento:</span> <strong>{c.fillRate}%</strong></div>
              <div><span className="text-muted-foreground">Presenza:</span> <strong>{c.attendanceRate}%</strong></div>
              <div><span className="text-muted-foreground">No-show:</span> <strong>{c.noShows}</strong></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   11. OPEN ISSUES
   ═══════════════════════════════════════════════════════════ */

function OpenIssuesDetail() {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-issues-full"],
    queryFn: async () => {
      const { data: issues } = await supabase.from("issues")
        .select("id, title, description, status, priority, created_at, resolved_at, resolved_by, reporter_name, reporter_id, event_id, resolution_notes")
        .order("created_at", { ascending: false }).limit(300);

      const allIssues = issues || [];
      const open = allIssues.filter(i => i.status === "open");
      const inProgress = allIssues.filter(i => i.status === "in_progress");
      const resolved = allIssues.filter(i => i.status === "resolved");
      const high = allIssues.filter(i => i.priority === "high");
      const medium = allIssues.filter(i => i.priority === "medium");
      const low = allIssues.filter(i => i.priority === "low");

      // Average resolution time
      const resolvedWithTime = resolved.filter(i => i.resolved_at);
      const avgResolutionHours = resolvedWithTime.length > 0
        ? Math.round(resolvedWithTime.reduce((s, i) => s + differenceInHours(new Date(i.resolved_at!), new Date(i.created_at)), 0) / resolvedWithTime.length)
        : 0;
      const avgResolutionDays = Math.round(avgResolutionHours / 24 * 10) / 10;

      return {
        issues: allIssues, open: open.length, inProgress: inProgress.length, resolved: resolved.length,
        high: high.length, medium: medium.length, low: low.length,
        total: allIssues.length,
        avgResolutionHours, avgResolutionDays,
      };
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Totale segnalazioni" value={data.total} />
        <MiniStat label="Aperte" value={data.open} color="text-destructive" />
        <MiniStat label="In corso" value={data.inProgress} color="text-warning" />
        <MiniStat label="Risolte" value={data.resolved} color="text-success" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Priorità alta" value={data.high} color="text-destructive" />
        <MiniStat label="Priorità media" value={data.medium} color="text-warning" />
        <MiniStat label="Priorità bassa" value={data.low} />
        <MiniStat label="Tempo medio risoluzione" value={data.avgResolutionDays > 0 ? `${data.avgResolutionDays} giorni` : "N/A"} sub={data.avgResolutionHours > 0 ? `${data.avgResolutionHours} ore` : ""} />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Tutte ({data.total})</TabsTrigger>
          <TabsTrigger value="open">Aperte ({data.open})</TabsTrigger>
          <TabsTrigger value="in_progress">In corso ({data.inProgress})</TabsTrigger>
          <TabsTrigger value="resolved">Risolte ({data.resolved})</TabsTrigger>
        </TabsList>
        {["all", "open", "in_progress", "resolved"].map(tab => (
          <TabsContent key={tab} value={tab}>
            <div className="rounded-xl border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titolo</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead>Segnalato da</TableHead>
                    <TableHead>Priorità</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Data apertura</TableHead>
                    <TableHead>Data risoluzione</TableHead>
                    <TableHead>Tempo risoluzione</TableHead>
                    <TableHead>Note risoluzione</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.issues
                    .filter(i => tab === "all" || i.status === tab)
                    .map(issue => {
                      const resTime = issue.resolved_at ? differenceInDays(new Date(issue.resolved_at), new Date(issue.created_at)) : null;
                      return (
                        <TableRow key={issue.id}>
                          <TableCell className="font-medium max-w-[180px] truncate">{issue.title}</TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{issue.description || "—"}</TableCell>
                          <TableCell className="text-xs">{issue.reporter_name || "—"}</TableCell>
                          <TableCell>{statusBadge(issue.priority)}</TableCell>
                          <TableCell>{statusBadge(issue.status)}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{format(new Date(issue.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{issue.resolved_at ? format(new Date(issue.resolved_at), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
                          <TableCell className="text-xs">{resTime !== null ? `${resTime} giorni` : "—"}</TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">{issue.resolution_notes || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   12. COMMUNITY HEALTH
   ═══════════════════════════════════════════════════════════ */

function CommunityHealthDetail({ filters }: { filters: DashboardFilterValues }) {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-health-full", filters],
    queryFn: async () => {
      const { count: totalRegs } = await supabase.from("event_registrations").select("*", { count: "exact", head: true }).in("status", ["registered", "paid", "attended"]);
      const { count: checkedIn } = await supabase.from("event_registrations").select("*", { count: "exact", head: true }).eq("checked_in", true);
      const { count: noShows } = await supabase.from("event_registrations").select("*", { count: "exact", head: true }).eq("status", "no_show");
      const { count: cancelled } = await supabase.from("event_registrations").select("*", { count: "exact", head: true }).eq("status", "cancelled");
      const { count: waitlist } = await supabase.from("event_registrations").select("*", { count: "exact", head: true }).eq("status", "waitlist");
      const { count: totalUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      const { count: activeUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("account_status", "Active");
      const { count: suspendedUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("account_status", "Suspended");
      const { count: bannedUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("account_status", "Banned");
      const { count: openIssues } = await supabase.from("issues").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress"]);
      const { count: totalIssues } = await supabase.from("issues").select("*", { count: "exact", head: true });
      const { count: resolvedIssues } = await supabase.from("issues").select("*", { count: "exact", head: true }).eq("status", "resolved");
      const { count: activeMembers } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("membership_status", "Active");
      const { count: totalEvents } = await supabase.from("events").select("*", { count: "exact", head: true });

      // Participating users
      const { data: regUsers } = await supabase.from("event_registrations").select("user_id").in("status", ["registered", "paid", "attended"]);
      const participatingUsers = new Set(regUsers?.map(r => r.user_id)).size;

      const attendanceRate = (totalRegs || 0) > 0 ? Math.round(((checkedIn || 0) / (totalRegs || 1)) * 100) : 0;
      const noShowRate = (totalRegs || 0) > 0 ? Math.round(((noShows || 0) / (totalRegs || 1)) * 100) : 0;
      const cancellationRate = ((totalRegs || 0) + (cancelled || 0)) > 0 ? Math.round(((cancelled || 0) / ((totalRegs || 0) + (cancelled || 0))) * 100) : 0;
      const activeUsersPct = (totalUsers || 0) > 0 ? Math.round(((activeUsers || 0) / (totalUsers || 1)) * 100) : 0;
      const participationRate = (totalUsers || 0) > 0 ? Math.round((participatingUsers / (totalUsers || 1)) * 100) : 0;
      const membershipRate = (totalUsers || 0) > 0 ? Math.round(((activeMembers || 0) / (totalUsers || 1)) * 100) : 0;
      const issueResolutionRate = (totalIssues || 0) > 0 ? Math.round(((resolvedIssues || 0) / (totalIssues || 1)) * 100) : 0;

      let score = 0;
      if (attendanceRate > 70) score += 3; else if (attendanceRate > 40) score += 2; else score += 1;
      if (noShowRate < 10) score += 3; else if (noShowRate < 25) score += 2; else score += 1;
      if (activeUsersPct > 80) score += 3; else if (activeUsersPct > 50) score += 2; else score += 1;
      if ((openIssues || 0) === 0) score += 3; else if ((openIssues || 0) <= 3) score += 2; else score += 1;

      let label = "Critica"; let labelColor = "text-destructive";
      if (score >= 10) { label = "Ottima"; labelColor = "text-success"; }
      else if (score >= 7) { label = "Buona"; labelColor = "text-primary"; }
      else if (score >= 5) { label = "Da migliorare"; labelColor = "text-warning"; }

      return {
        // Core metrics
        attendanceRate, noShowRate, cancellationRate, activeUsersPct, participationRate, membershipRate,
        // Counts
        totalUsers: totalUsers || 0, activeUsers: activeUsers || 0, suspendedUsers: suspendedUsers || 0, bannedUsers: bannedUsers || 0,
        totalRegs: totalRegs || 0, checkedIn: checkedIn || 0, noShows: noShows || 0, cancelled: cancelled || 0, waitlist: waitlist || 0,
        openIssues: openIssues || 0, totalIssues: totalIssues || 0, resolvedIssues: resolvedIssues || 0, issueResolutionRate,
        activeMembers: activeMembers || 0, participatingUsers, totalEvents: totalEvents || 0,
        // Score
        label, labelColor, score,
      };
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <FormulaBox
        formula={`Punteggio = Tasso presenza (${data.attendanceRate > 70 ? 3 : data.attendanceRate > 40 ? 2 : 1}) + No-show basso (${data.noShowRate < 10 ? 3 : data.noShowRate < 25 ? 2 : 1}) + Utenti attivi (${data.activeUsersPct > 80 ? 3 : data.activeUsersPct > 50 ? 2 : 1}) + Segnalazioni (${data.openIssues === 0 ? 3 : data.openIssues <= 3 ? 2 : 1}) = ${data.score}/12`}
        description="≥10 Ottima | ≥7 Buona | ≥5 Da migliorare | <5 Critica"
      />

      <div className="text-center py-6 rounded-xl border bg-card">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Stato Salute Community</p>
        <p className={`text-5xl font-bold ${data.labelColor}`}>{data.label}</p>
        <p className="text-sm text-muted-foreground mt-2">Punteggio: {data.score}/12</p>
      </div>

      <SectionTitle>📊 Indicatori chiave</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <HealthMetric label="Tasso presenza" value={`${data.attendanceRate}%`} good={data.attendanceRate > 70} warn={data.attendanceRate > 40} />
        <HealthMetric label="Tasso no-show" value={`${data.noShowRate}%`} good={data.noShowRate < 10} warn={data.noShowRate < 25} />
        <HealthMetric label="Tasso cancellazione" value={`${data.cancellationRate}%`} good={data.cancellationRate < 10} warn={data.cancellationRate < 25} />
        <HealthMetric label="Utenti attivi" value={`${data.activeUsersPct}%`} good={data.activeUsersPct > 80} warn={data.activeUsersPct > 50} />
        <HealthMetric label="Tasso partecipazione" value={`${data.participationRate}%`} good={data.participationRate > 50} warn={data.participationRate > 25} />
        <HealthMetric label="Tasso tesseramento" value={`${data.membershipRate}%`} good={data.membershipRate > 50} warn={data.membershipRate > 25} />
      </div>

      <SectionTitle>👥 Utenti</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <MiniStat label="Totale utenti" value={data.totalUsers} />
        <MiniStat label="Attivi" value={data.activeUsers} color="text-success" />
        <MiniStat label="Sospesi" value={data.suspendedUsers} color="text-warning" />
        <MiniStat label="Banditi" value={data.bannedUsers} color="text-destructive" />
        <MiniStat label="Partecipanti" value={data.participatingUsers} color="text-primary" />
      </div>

      <SectionTitle>📋 Iscrizioni & Presenze</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <MiniStat label="Iscrizioni totali" value={data.totalRegs} />
        <MiniStat label="Check-in" value={data.checkedIn} color="text-success" />
        <MiniStat label="No-show" value={data.noShows} color="text-destructive" />
        <MiniStat label="Cancellazioni" value={data.cancelled} color="text-warning" />
        <MiniStat label="In waitlist" value={data.waitlist} color="text-warning" />
      </div>

      <SectionTitle>🔧 Segnalazioni</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Segnalazioni totali" value={data.totalIssues} />
        <MiniStat label="Aperte" value={data.openIssues} color="text-destructive" />
        <MiniStat label="Risolte" value={data.resolvedIssues} color="text-success" />
        <MiniStat label="Tasso risoluzione" value={`${data.issueResolutionRate}%`} color={data.issueResolutionRate > 70 ? "text-success" : "text-warning"} />
      </div>

      <SectionTitle>🏛️ Altro</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MiniStat label="Tesserati attivi" value={data.activeMembers} color="text-success" />
        <MiniStat label="Totale eventi" value={data.totalEvents} />
        <MiniStat label="Media iscrizioni/evento" value={data.totalEvents > 0 ? Math.round(data.totalRegs / data.totalEvents) : 0} />
      </div>
    </div>
  );
}

/* ═══════ Main Content Router ═══════ */

export function KPIDetailContent({ type, filters }: { type: KPIType; filters: DashboardFilterValues }) {
  if (!type) return null;
  switch (type) {
    case "total-users": return <TotalUsersDetail filters={filters} />;
    case "active-members": return <ActiveMembersDetail filters={filters} />;
    case "participating-users": return <ParticipatingUsersDetail filters={filters} />;
    case "events-created": return <EventsCreatedDetail filters={filters} />;
    case "participation-rate": return <ParticipationRateDetail filters={filters} />;
    case "attendance-rate": return <AttendanceRateDetail filters={filters} />;
    case "fill-rate": return <FillRateDetail filters={filters} />;
    case "waitlist": return <WaitlistDetail filters={filters} />;
    case "repeat-participants": return <RepeatParticipantsDetail filters={filters} />;
    case "top-category": return <TopCategoryDetail filters={filters} />;
    case "open-issues": return <OpenIssuesDetail />;
    case "community-health": return <CommunityHealthDetail filters={filters} />;
    default: return <p className="text-muted-foreground">KPI non supportato.</p>;
  }
}
