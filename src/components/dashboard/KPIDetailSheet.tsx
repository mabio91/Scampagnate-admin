import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useLanguage } from "@/i18n/LanguageContext";
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

interface KPIDetailSheetProps {
  open: KPIType;
  onClose: () => void;
  filters: DashboardFilterValues;
}

const KPI_META: Record<string, { title: string; titleIt: string; description: string; descriptionIt: string }> = {
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
  };
  return <Badge variant="outline" className={colors[status] || ""}>{status}</Badge>;
}

function LoadingSkeleton() {
  return <div className="space-y-3 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
}

/* ═══════ Individual detail views ═══════ */

function TotalUsersDetail({ filters }: { filters: DashboardFilterValues }) {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-users", filters],
    queryFn: async () => {
      let q = supabase.from("profiles").select("id, first_name, last_name, email, account_status, membership_status, onboarding_completed, created_at");
      if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom.toISOString());
      if (filters.dateTo) q = q.lte("created_at", filters.dateTo.toISOString());
      const { data } = await q.order("created_at", { ascending: false }).limit(200);
      return data || [];
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  const total = data?.length || 0;
  const active = data?.filter(u => u.account_status === "Active").length || 0;
  const suspended = data?.filter(u => u.account_status === "Suspended").length || 0;
  const banned = data?.filter(u => u.account_status === "Banned").length || 0;
  const onboarded = data?.filter(u => u.onboarding_completed).length || 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MiniStat label="Totale" value={total} />
        <MiniStat label="Attivi" value={active} color="text-success" />
        <MiniStat label="Sospesi" value={suspended} color="text-warning" />
        <MiniStat label="Banditi" value={banned} color="text-destructive" />
        <MiniStat label="Onboarding completato" value={onboarded} />
        <MiniStat label="Onboarding incompleto" value={total - onboarded} />
      </div>
      <div className="overflow-auto max-h-[50vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Tessera</TableHead>
              <TableHead>Iscritto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.first_name} {u.last_name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{u.email || "—"}</TableCell>
                <TableCell>{statusBadge(u.account_status || "Active")}</TableCell>
                <TableCell><Badge variant="outline">{u.membership_status || "Inactive"}</Badge></TableCell>
                <TableCell className="text-xs">{format(new Date(u.created_at), "dd/MM/yyyy")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ActiveMembersDetail({ filters }: { filters: DashboardFilterValues }) {
  const currentYear = new Date().getFullYear();
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-members", filters],
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("id, first_name, last_name, membership_status, membership_year, membership_id, is_founding_member, membership_registration_date")
        .not("membership_id", "is", null)
        .order("membership_registration_date", { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  const active = data?.filter(m => m.membership_status === "Active" && m.membership_year === currentYear).length || 0;
  const expired = data?.filter(m => m.membership_status !== "Active" || (m.membership_year && m.membership_year < currentYear)).length || 0;
  const founding = data?.filter(m => m.is_founding_member).length || 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Attivi" value={active} color="text-success" />
        <MiniStat label="Scaduti" value={expired} color="text-warning" />
        <MiniStat label="Fondatori" value={founding} color="text-accent" />
        <MiniStat label="Totale tessere" value={data?.length || 0} />
      </div>
      <div className="overflow-auto max-h-[50vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>ID Tessera</TableHead>
              <TableHead>Anno</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Fondatore</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.first_name} {m.last_name}</TableCell>
                <TableCell className="font-mono text-xs">{m.membership_id}</TableCell>
                <TableCell>{m.membership_year || "—"}</TableCell>
                <TableCell>{statusBadge(m.membership_status || "Inactive")}</TableCell>
                <TableCell>{m.is_founding_member ? "⭐" : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ParticipatingUsersDetail({ filters }: { filters: DashboardFilterValues }) {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-participating", filters],
    queryFn: async () => {
      let q = supabase.from("event_registrations").select("user_id, status, checked_in, created_at, events!inner(date, title)");
      if (filters.dateFrom) q = q.gte("events.date", format(filters.dateFrom, "yyyy-MM-dd"));
      if (filters.dateTo) q = q.lte("events.date", format(filters.dateTo, "yyyy-MM-dd"));
      const { data: regs } = await q;
      if (!regs) return [];

      const userMap: Record<string, { userId: string; eventsJoined: number; eventsAttended: number; lastEvent: string; lastDate: string; noShows: number }> = {};
      regs.forEach((r: any) => {
        if (!userMap[r.user_id]) {
          userMap[r.user_id] = { userId: r.user_id, eventsJoined: 0, eventsAttended: 0, lastEvent: "", lastDate: "", noShows: 0 };
        }
        const u = userMap[r.user_id];
        if (["registered", "paid", "attended"].includes(r.status)) u.eventsJoined++;
        if (r.checked_in) u.eventsAttended++;
        if (r.status === "no_show") u.noShows++;
        if (!u.lastDate || r.events.date > u.lastDate) {
          u.lastDate = r.events.date;
          u.lastEvent = r.events.title;
        }
      });

      const userIds = Object.keys(userMap);
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name").in("id", userIds.slice(0, 200));
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

      return Object.values(userMap)
        .filter(u => u.eventsJoined > 0)
        .sort((a, b) => b.eventsAttended - a.eventsAttended)
        .slice(0, 200)
        .map(u => ({ ...u, name: profileMap[u.userId] ? `${profileMap[u.userId].first_name} ${profileMap[u.userId].last_name}` : u.userId }));
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <MiniStat label="Utenti partecipanti" value={data?.length || 0} />
      <div className="overflow-auto max-h-[55vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Eventi iscritti</TableHead>
              <TableHead>Presenze</TableHead>
              <TableHead>No-show</TableHead>
              <TableHead>Ultimo evento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((u, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.eventsJoined}</TableCell>
                <TableCell className="text-success font-semibold">{u.eventsAttended}</TableCell>
                <TableCell className={u.noShows > 0 ? "text-destructive" : ""}>{u.noShows}</TableCell>
                <TableCell className="text-xs">{u.lastEvent}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function EventsCreatedDetail({ filters }: { filters: DashboardFilterValues }) {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-events", filters],
    queryFn: async () => {
      let q = supabase.from("events").select("id, title, date, status, spots_total, spots_taken, category_id, organizer_name, created_at");
      if (filters.dateFrom) q = q.gte("date", format(filters.dateFrom, "yyyy-MM-dd"));
      if (filters.dateTo) q = q.lte("date", format(filters.dateTo, "yyyy-MM-dd"));
      if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
      if (filters.organizerId) q = q.eq("organizer_id", filters.organizerId);
      const { data } = await q.order("date", { ascending: false }).limit(200);
      return data || [];
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="overflow-auto max-h-[60vh]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Evento</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Organizzatore</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead>Iscritti</TableHead>
            <TableHead>Riempimento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map(e => (
            <TableRow key={e.id}>
              <TableCell className="font-medium max-w-[200px] truncate">{e.title}</TableCell>
              <TableCell className="text-xs">{format(new Date(e.date), "dd/MM/yyyy")}</TableCell>
              <TableCell className="text-xs">{e.organizer_name}</TableCell>
              <TableCell>{statusBadge(e.status)}</TableCell>
              <TableCell>{e.spots_taken}/{e.spots_total}</TableCell>
              <TableCell className="font-semibold">{e.spots_total > 0 ? Math.round((e.spots_taken / e.spots_total) * 100) : 0}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ParticipationRateDetail({ filters }: { filters: DashboardFilterValues }) {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-participation-rate", filters],
    queryFn: async () => {
      const { count: totalUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      const { data: regs } = await supabase.from("event_registrations").select("user_id, events!inner(date, category_id, organizer_id)").in("status", ["registered", "paid", "attended"]);

      const filtered = (regs || []).filter((r: any) => {
        if (filters.dateFrom && r.events.date < format(filters.dateFrom, "yyyy-MM-dd")) return false;
        if (filters.dateTo && r.events.date > format(filters.dateTo, "yyyy-MM-dd")) return false;
        if (filters.categoryId && r.events.category_id !== filters.categoryId) return false;
        if (filters.organizerId && r.events.organizer_id !== filters.organizerId) return false;
        return true;
      });

      const uniqueUsers = new Set(filtered.map((r: any) => r.user_id));

      // By category
      const { data: cats } = await supabase.from("event_categories").select("id, name");
      const catMap = Object.fromEntries((cats || []).map(c => [c.id, c.name]));
      const byCat: Record<string, Set<string>> = {};
      filtered.forEach((r: any) => {
        const catName = catMap[r.events.category_id] || "Senza categoria";
        if (!byCat[catName]) byCat[catName] = new Set();
        byCat[catName].add(r.user_id);
      });

      return {
        totalUsers: totalUsers || 0,
        participatingUsers: uniqueUsers.size,
        rate: totalUsers ? Math.round((uniqueUsers.size / totalUsers) * 100) : 0,
        byCategory: Object.entries(byCat).map(([name, users]) => ({ name, count: users.size })).sort((a, b) => b.count - a.count),
      };
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Utenti totali" value={data.totalUsers} />
        <MiniStat label="Utenti partecipanti" value={data.participatingUsers} color="text-primary" />
        <MiniStat label="Tasso" value={`${data.rate}%`} color="text-success" />
      </div>
      <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        <strong>Formula:</strong> Utenti con ≥1 iscrizione ({data.participatingUsers}) / Utenti totali ({data.totalUsers}) = <strong className="text-foreground">{data.rate}%</strong>
      </div>
      <h4 className="text-sm font-semibold">Partecipazione per categoria</h4>
      <Table>
        <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Utenti unici</TableHead></TableRow></TableHeader>
        <TableBody>
          {data.byCategory.map(c => (
            <TableRow key={c.name}><TableCell>{c.name}</TableCell><TableCell className="font-semibold">{c.count}</TableCell></TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AttendanceRateDetail({ filters }: { filters: DashboardFilterValues }) {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-attendance-rate", filters],
    queryFn: async () => {
      const { data: regs } = await supabase.from("event_registrations")
        .select("status, checked_in, events!inner(id, title, date, category_id, organizer_id, organizer_name)")
        .in("status", ["registered", "paid", "attended", "no_show", "cancelled"]);

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
      const eventMap: Record<string, { title: string; regs: number; checkedIn: number; noShows: number }> = {};
      filtered.forEach((r: any) => {
        if (!eventMap[r.events.id]) eventMap[r.events.id] = { title: r.events.title, regs: 0, checkedIn: 0, noShows: 0 };
        if (["registered", "paid", "attended"].includes(r.status)) eventMap[r.events.id].regs++;
        if (r.checked_in) eventMap[r.events.id].checkedIn++;
        if (r.status === "no_show") eventMap[r.events.id].noShows++;
      });

      return {
        totalRegs,
        checkedIn,
        rate: totalRegs > 0 ? Math.round((checkedIn / totalRegs) * 100) : 0,
        noShows,
        noShowRate: totalRegs > 0 ? Math.round((noShows / totalRegs) * 100) : 0,
        cancelled,
        byEvent: Object.values(eventMap).sort((a, b) => b.regs - a.regs).slice(0, 50),
      };
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Iscrizioni totali" value={data.totalRegs} />
        <MiniStat label="Check-in" value={data.checkedIn} color="text-success" />
        <MiniStat label="Tasso presenza" value={`${data.rate}%`} color="text-success" />
        <MiniStat label="No-show" value={`${data.noShows} (${data.noShowRate}%)`} color="text-destructive" />
      </div>
      <h4 className="text-sm font-semibold">Dettaglio per evento</h4>
      <div className="overflow-auto max-h-[45vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Evento</TableHead>
              <TableHead>Iscritti</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead>Tasso</TableHead>
              <TableHead>No-show</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.byEvent.map((e, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium max-w-[180px] truncate">{e.title}</TableCell>
                <TableCell>{e.regs}</TableCell>
                <TableCell className="text-success">{e.checkedIn}</TableCell>
                <TableCell className="font-semibold">{e.regs > 0 ? Math.round((e.checkedIn / e.regs) * 100) : 0}%</TableCell>
                <TableCell className={e.noShows > 0 ? "text-destructive" : ""}>{e.noShows}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function FillRateDetail({ filters }: { filters: DashboardFilterValues }) {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-fill-rate", filters],
    queryFn: async () => {
      let q = supabase.from("events").select("id, title, spots_total, spots_taken, category_id, organizer_name, date").gt("spots_total", 0);
      if (filters.dateFrom) q = q.gte("date", format(filters.dateFrom, "yyyy-MM-dd"));
      if (filters.dateTo) q = q.lte("date", format(filters.dateTo, "yyyy-MM-dd"));
      if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
      if (filters.organizerId) q = q.eq("organizer_id", filters.organizerId);
      const { data } = await q.order("date", { ascending: false }).limit(200);
      return (data || []).map(e => ({ ...e, fillRate: Math.round((e.spots_taken / e.spots_total) * 100) }));
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="overflow-auto max-h-[60vh]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Evento</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Capacità</TableHead>
            <TableHead>Iscritti</TableHead>
            <TableHead>Riempimento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map(e => (
            <TableRow key={e.id}>
              <TableCell className="font-medium max-w-[180px] truncate">{e.title}</TableCell>
              <TableCell className="text-xs">{format(new Date(e.date), "dd/MM/yyyy")}</TableCell>
              <TableCell>{e.spots_total}</TableCell>
              <TableCell>{e.spots_taken}</TableCell>
              <TableCell>
                <span className={e.fillRate >= 80 ? "text-success font-bold" : e.fillRate >= 50 ? "text-warning font-semibold" : "text-muted-foreground"}>
                  {e.fillRate}%
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function WaitlistDetail({ filters }: { filters: DashboardFilterValues }) {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-waitlist", filters],
    queryFn: async () => {
      const { data: regs } = await supabase.from("event_registrations")
        .select("user_id, status, events!inner(id, title, date)")
        .eq("status", "waitlist");

      if (!regs) return [];

      const eventMap: Record<string, { title: string; date: string; waitlistCount: number; userIds: string[] }> = {};
      regs.forEach((r: any) => {
        if (filters.dateFrom && r.events.date < format(filters.dateFrom, "yyyy-MM-dd")) return;
        if (filters.dateTo && r.events.date > format(filters.dateTo, "yyyy-MM-dd")) return;
        if (!eventMap[r.events.id]) eventMap[r.events.id] = { title: r.events.title, date: r.events.date, waitlistCount: 0, userIds: [] };
        eventMap[r.events.id].waitlistCount++;
        eventMap[r.events.id].userIds.push(r.user_id);
      });

      return Object.values(eventMap).sort((a, b) => b.waitlistCount - a.waitlistCount);
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <MiniStat label="Totale in lista d'attesa" value={data?.reduce((s, e) => s + e.waitlistCount, 0) || 0} color="text-warning" />
      <div className="overflow-auto max-h-[55vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Evento</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>In attesa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((e, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{e.title}</TableCell>
                <TableCell className="text-xs">{format(new Date(e.date), "dd/MM/yyyy")}</TableCell>
                <TableCell className="font-semibold text-warning">{e.waitlistCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function RepeatParticipantsDetail({ filters }: { filters: DashboardFilterValues }) {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-repeat", filters],
    queryFn: async () => {
      const { data: regs } = await supabase.from("event_registrations")
        .select("user_id, checked_in, events!inner(date)")
        .eq("checked_in", true);

      if (!regs) return [];

      const counts: Record<string, number> = {};
      (regs as any[]).forEach(r => {
        if (filters.dateFrom && r.events.date < format(filters.dateFrom, "yyyy-MM-dd")) return;
        if (filters.dateTo && r.events.date > format(filters.dateTo, "yyyy-MM-dd")) return;
        counts[r.user_id] = (counts[r.user_id] || 0) + 1;
      });

      const frequentUserIds = Object.entries(counts).filter(([, c]) => c > 3).sort((a, b) => b[1] - a[1]);
      if (frequentUserIds.length === 0) return [];

      const ids = frequentUserIds.map(([id]) => id).slice(0, 100);
      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, membership_status").in("id", ids);
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

      // Get badges count
      const { data: badges } = await supabase.from("user_badges").select("user_id").in("user_id", ids);
      const badgeCount: Record<string, number> = {};
      badges?.forEach(b => { badgeCount[b.user_id] = (badgeCount[b.user_id] || 0) + 1; });

      return frequentUserIds.map(([userId, count]) => ({
        name: profileMap[userId] ? `${profileMap[userId].first_name} ${profileMap[userId].last_name}` : userId,
        eventsAttended: count,
        badges: badgeCount[userId] || 0,
        membership: profileMap[userId]?.membership_status || "Inactive",
      }));
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="overflow-auto max-h-[60vh]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Eventi</TableHead>
            <TableHead>Badge</TableHead>
            <TableHead>Tessera</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map((u, i) => (
            <TableRow key={i}>
              <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
              <TableCell className="font-medium">{u.name}</TableCell>
              <TableCell className="font-semibold text-primary">{u.eventsAttended}</TableCell>
              <TableCell>{u.badges > 0 ? `🏅 ${u.badges}` : "—"}</TableCell>
              <TableCell>{statusBadge(u.membership)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TopCategoryDetail({ filters }: { filters: DashboardFilterValues }) {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-top-category", filters],
    queryFn: async () => {
      const { data: cats } = await supabase.from("event_categories").select("id, name");
      let eq = supabase.from("events").select("id, category_id, spots_total, spots_taken, date");
      if (filters.dateFrom) eq = eq.gte("date", format(filters.dateFrom, "yyyy-MM-dd"));
      if (filters.dateTo) eq = eq.lte("date", format(filters.dateTo, "yyyy-MM-dd"));
      const { data: events } = await eq;

      const { data: regs } = await supabase.from("event_registrations").select("event_id, checked_in, status").in("status", ["registered", "paid", "attended"]);

      if (!cats || !events) return [];

      const eventIds = new Set(events.map(e => e.id));

      return cats.map(cat => {
        const catEvents = events.filter(e => e.category_id === cat.id);
        const catEventIds = new Set(catEvents.map(e => e.id));
        const catRegs = (regs || []).filter(r => catEventIds.has(r.event_id) && eventIds.has(r.event_id));
        const checkedIn = catRegs.filter(r => r.checked_in).length;

        const totalSpots = catEvents.reduce((s, e) => s + (e.spots_total || 0), 0);
        const takenSpots = catEvents.reduce((s, e) => s + (e.spots_taken || 0), 0);

        return {
          name: cat.name,
          events: catEvents.length,
          registrations: catRegs.length,
          fillRate: totalSpots > 0 ? Math.round((takenSpots / totalSpots) * 100) : 0,
          attendanceRate: catRegs.length > 0 ? Math.round((checkedIn / catRegs.length) * 100) : 0,
        };
      }).sort((a, b) => b.events - a.events);
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="overflow-auto max-h-[60vh]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Eventi</TableHead>
            <TableHead>Iscrizioni</TableHead>
            <TableHead>Riempimento</TableHead>
            <TableHead>Presenza</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map((c, i) => (
            <TableRow key={i}>
              <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell>{c.events}</TableCell>
              <TableCell>{c.registrations}</TableCell>
              <TableCell className="font-semibold">{c.fillRate}%</TableCell>
              <TableCell className="font-semibold">{c.attendanceRate}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function OpenIssuesDetail() {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-issues"],
    queryFn: async () => {
      const { data } = await supabase.from("issues")
        .select("id, title, status, priority, created_at, resolved_at, reporter_name")
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="overflow-auto max-h-[60vh]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Titolo</TableHead>
            <TableHead>Segnalato da</TableHead>
            <TableHead>Priorità</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Risolto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map(issue => (
            <TableRow key={issue.id}>
              <TableCell className="font-medium max-w-[200px] truncate">{issue.title}</TableCell>
              <TableCell className="text-xs">{issue.reporter_name || "—"}</TableCell>
              <TableCell>{statusBadge(issue.priority)}</TableCell>
              <TableCell>{statusBadge(issue.status)}</TableCell>
              <TableCell className="text-xs">{format(new Date(issue.created_at), "dd/MM/yyyy")}</TableCell>
              <TableCell className="text-xs">{issue.resolved_at ? format(new Date(issue.resolved_at), "dd/MM/yyyy") : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CommunityHealthDetail({ filters }: { filters: DashboardFilterValues }) {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-detail-health", filters],
    queryFn: async () => {
      // Attendance rate
      const { count: totalRegs } = await supabase.from("event_registrations").select("*", { count: "exact", head: true }).in("status", ["registered", "paid", "attended"]);
      const { count: checkedIn } = await supabase.from("event_registrations").select("*", { count: "exact", head: true }).eq("checked_in", true);
      const { count: noShows } = await supabase.from("event_registrations").select("*", { count: "exact", head: true }).eq("status", "no_show");
      const { count: cancelled } = await supabase.from("event_registrations").select("*", { count: "exact", head: true }).eq("status", "cancelled");
      const { count: totalUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      const { count: activeUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("account_status", "Active");
      const { count: openIssues } = await supabase.from("issues").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress"]);

      const attendanceRate = (totalRegs || 0) > 0 ? Math.round(((checkedIn || 0) / (totalRegs || 1)) * 100) : 0;
      const noShowRate = (totalRegs || 0) > 0 ? Math.round(((noShows || 0) / (totalRegs || 1)) * 100) : 0;
      const cancellationRate = ((totalRegs || 0) + (cancelled || 0)) > 0 ? Math.round(((cancelled || 0) / ((totalRegs || 0) + (cancelled || 0))) * 100) : 0;
      const activeUsersPct = (totalUsers || 0) > 0 ? Math.round(((activeUsers || 0) / (totalUsers || 1)) * 100) : 0;

      // Health score
      let score = 0;
      if (attendanceRate > 70) score += 3; else if (attendanceRate > 40) score += 2; else score += 1;
      if (noShowRate < 10) score += 3; else if (noShowRate < 25) score += 2; else score += 1;
      if (activeUsersPct > 80) score += 3; else if (activeUsersPct > 50) score += 2; else score += 1;
      if ((openIssues || 0) === 0) score += 3; else if ((openIssues || 0) <= 3) score += 2; else score += 1;

      let label = "Critica";
      let labelColor = "text-destructive";
      if (score >= 10) { label = "Ottima"; labelColor = "text-success"; }
      else if (score >= 7) { label = "Buona"; labelColor = "text-primary"; }
      else if (score >= 5) { label = "Da migliorare"; labelColor = "text-warning"; }

      return {
        attendanceRate, noShowRate, cancellationRate, activeUsersPct,
        openIssues: openIssues || 0,
        label, labelColor, score,
      };
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="text-center py-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Stato Salute Community</p>
        <p className={`text-4xl font-bold ${data.labelColor}`}>{data.label}</p>
        <p className="text-sm text-muted-foreground mt-1">Punteggio: {data.score}/12</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <HealthMetric label="Tasso presenza" value={`${data.attendanceRate}%`} good={data.attendanceRate > 70} warn={data.attendanceRate > 40} />
        <HealthMetric label="Tasso no-show" value={`${data.noShowRate}%`} good={data.noShowRate < 10} warn={data.noShowRate < 25} invert />
        <HealthMetric label="Tasso cancellazione" value={`${data.cancellationRate}%`} good={data.cancellationRate < 10} warn={data.cancellationRate < 25} invert />
        <HealthMetric label="Utenti attivi" value={`${data.activeUsersPct}%`} good={data.activeUsersPct > 80} warn={data.activeUsersPct > 50} />
        <HealthMetric label="Segnalazioni aperte" value={String(data.openIssues)} good={data.openIssues === 0} warn={data.openIssues <= 3} invert />
      </div>
    </div>
  );
}

function HealthMetric({ label, value, good, warn, invert }: { label: string; value: string; good: boolean; warn: boolean; invert?: boolean }) {
  const color = good ? "text-success" : warn ? "text-warning" : "text-destructive";
  return (
    <div className="rounded-lg border p-3 bg-card">
      <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg bg-muted/50 border p-3">
      <p className="text-[11px] text-muted-foreground font-medium truncate">{label}</p>
      <p className={`text-lg font-bold ${color || "text-foreground"}`}>{value}</p>
    </div>
  );
}

/* ═══════ Main Sheet Component ═══════ */

export function KPIDetailSheet({ open, onClose, filters }: KPIDetailSheetProps) {
  const { language } = useLanguage();
  const meta = open ? KPI_META[open] : null;

  return (
    <Sheet open={!!open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>{language === "it" ? meta?.titleIt : meta?.title}</SheetTitle>
          <SheetDescription>{language === "it" ? meta?.descriptionIt : meta?.description}</SheetDescription>
        </SheetHeader>
        {open === "total-users" && <TotalUsersDetail filters={filters} />}
        {open === "active-members" && <ActiveMembersDetail filters={filters} />}
        {open === "participating-users" && <ParticipatingUsersDetail filters={filters} />}
        {open === "events-created" && <EventsCreatedDetail filters={filters} />}
        {open === "participation-rate" && <ParticipationRateDetail filters={filters} />}
        {open === "attendance-rate" && <AttendanceRateDetail filters={filters} />}
        {open === "fill-rate" && <FillRateDetail filters={filters} />}
        {open === "waitlist" && <WaitlistDetail filters={filters} />}
        {open === "repeat-participants" && <RepeatParticipantsDetail filters={filters} />}
        {open === "top-category" && <TopCategoryDetail filters={filters} />}
        {open === "open-issues" && <OpenIssuesDetail />}
        {open === "community-health" && <CommunityHealthDetail filters={filters} />}
      </SheetContent>
    </Sheet>
  );
}
