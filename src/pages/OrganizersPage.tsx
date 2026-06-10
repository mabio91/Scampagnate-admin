import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MoreHorizontal, Trash2, Edit2, Download, ArrowUpDown } from "lucide-react";
import RefreshButton from "@/components/RefreshButton";
import { RowActionButton, RowActionCell } from "@/components/RowActions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { useLanguage } from "@/i18n/LanguageContext";
import { exportToCsv } from "@/lib/exportUtils";
import { isAnalyticsEventStatus, isAnalyticsRegistration } from "@/lib/analyticsEvents";

interface OrgUser {
  id: string; first_name: string; last_name: string; phone: string; email: string;
  bio: string | null; avatar_url: string | null;
  account_status: Database["public"]["Enums"]["account_status"] | null;
  membership_status: string | null; membership_id: number | null;
  is_founding_member: boolean; created_at: string; roles: string[];
  eventCount: number; last_sign_in_at: string | null;
}

type SortKey = "name" | "fillRate" | "attendanceRate" | "events";

export default function OrganizersPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [editOrg, setEditOrg] = useState<OrgUser | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "", last_name: "", phone: "", bio: "",
    account_status: "Active" as Database["public"]["Enums"]["account_status"]
  });
  const [editRole, setEditRole] = useState("organizer");
  const [confirmAction, setConfirmAction] = useState<{ type: "remove_role" | "ban" | "suspend"; userId: string; userName: string } | null>(null);
  const [perfSort, setPerfSort] = useState<SortKey>("events");
  const [perfSortDir, setPerfSortDir] = useState<"asc" | "desc">("desc");
  const queryClient = useQueryClient();

  // Fetch organizers AND admins (per requirement 9.1)
  const { data: organizers = [], isLoading } = useQuery({
    queryKey: ["admin-organizers"],
    queryFn: async () => {
      const { data: orgRoles } = await supabase.from("user_roles").select("user_id, role").in("role", ["organizer", "admin"] as any);
      if (!orgRoles?.length) return [];
      const orgIds = [...new Set(orgRoles.map((r) => r.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("*").in("id", orgIds);
      const { data: events } = await supabase.from("events").select("organizer_id, status");
      const { data: allRoles } = await supabase.from("user_roles").select("user_id, role").in("user_id", orgIds);
      let authUsers: { id: string; email: string; last_sign_in_at: string | null }[] = [];
      try {
        const res = await supabase.functions.invoke("list-users");
        if (res.data && !res.data.error) authUsers = res.data;
      } catch {
        // Auth metadata is optional for this listing.
      }
      const authMap = new Map(authUsers.map((u) => [u.id, u]));
      return (profiles || []).map((p) => ({
        ...p,
        roles: (allRoles || []).filter((r) => r.user_id === p.id).map((r) => r.role) || [],
        eventCount: events?.filter((e) => e.organizer_id === p.id && isAnalyticsEventStatus(e.status)).length || 0,
        email: authMap.get(p.id)?.email || p.email || "—",
        last_sign_in_at: authMap.get(p.id)?.last_sign_in_at || null,
      })) as OrgUser[];
    },
  });

  // Fetch events with registrations for performance metrics
  const { data: allEvents = [] } = useQuery({
    queryKey: ["admin-org-all-events"],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, organizer_id, title, date, status, spots_taken, spots_total, category_id");
      return data || [];
    },
  });

  const { data: allRegs = [] } = useQuery({
    queryKey: ["admin-org-all-regs"],
    queryFn: async () => {
      const { data } = await supabase.from("event_registrations").select("event_id, status, checked_in, events(status)");
      return (data || []).filter(isAnalyticsRegistration);
    },
  });

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!editOrg) return;
      const { error } = await supabase.from("profiles").update({
        first_name: editForm.first_name, last_name: editForm.last_name,
        phone: editForm.phone, bio: editForm.bio, account_status: editForm.account_status,
        updated_at: new Date().toISOString(),
      }).eq("id", editOrg.id);
      if (error) throw error;
      const currentRole = editOrg.roles.find((r) => ["admin", "organizer", "user"].includes(r)) || "organizer";
      if (editRole !== currentRole) {
        await supabase.from("user_roles").delete().eq("user_id", editOrg.id).eq("role", currentRole as any);
        await supabase.from("user_roles").insert({ user_id: editOrg.id, role: editRole as any });
      }
    },
    onSuccess: () => { toast.success("Organizer updated"); queryClient.invalidateQueries({ queryKey: ["admin-organizers"] }); setEditOrg(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: Database["public"]["Enums"]["account_status"] }) => {
      const { error } = await supabase.from("profiles").update({ account_status: status, updated_at: new Date().toISOString() }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status updated"); queryClient.invalidateQueries({ queryKey: ["admin-organizers"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeOrgRole = useMutation({
    mutationFn: async (userId: string) => {
      const org = organizers.find(o => o.id === userId);
      const rolesToRemove = (org?.roles || []).filter(r => r === "organizer" || r === "admin");
      for (const role of rolesToRemove) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as any);
        if (error) throw error;
      }
      // Add "user" role if not already present
      const hasUserRole = org?.roles.includes("user");
      if (!hasUserRole) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "user" as any });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Role changed to user"); queryClient.invalidateQueries({ queryKey: ["admin-organizers"] }); setConfirmAction(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (org: OrgUser) => {
    setEditOrg(org);
    setEditForm({ first_name: org.first_name, last_name: org.last_name, phone: org.phone, bio: org.bio || "", account_status: org.account_status || "Active" });
    setEditRole(org.roles.includes("admin") ? "admin" : org.roles.includes("organizer") ? "organizer" : "user");
  };

  const filtered = organizers.filter((o) => {
    const searchLower = search.toLowerCase();
    const matchesSearch = `${o.first_name} ${o.last_name}`.toLowerCase().includes(searchLower) ||
      (o.email || "").toLowerCase().includes(searchLower) || (o.phone || "").toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === "All" || o.account_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Performance data calculation
  const getOrgPerf = (orgId: string) => {
    const orgEvts = allEvents.filter((e) => e.organizer_id === orgId && isAnalyticsEventStatus(e.status));
    const totalEvents = orgEvts.length;
    const cancelledEvents = orgEvts.filter((e) => e.status === "cancelled").length;
    const nonCancelled = orgEvts.filter((e) => e.status !== "cancelled" && e.spots_total > 0);
    const fillRates = nonCancelled.map((e) => (e.spots_taken / e.spots_total) * 100);
    const avgFill = fillRates.length > 0 ? fillRates.reduce((a, b) => a + b, 0) / fillRates.length : 0;
    const cancRate = totalEvents > 0 ? (cancelledEvents / totalEvents) * 100 : 0;

    const today = new Date(new Date().setHours(0, 0, 0, 0));
    const pastEvtIds = orgEvts.filter((e) => new Date(e.date) < today).map((e) => e.id);
    const pastRegs = allRegs.filter((r) => pastEvtIds.includes(r.event_id) && (r.status === "registered" || r.status === "paid"));
    const checkedIn = pastRegs.filter((r) => r.checked_in).length;
    const avgAtt = pastRegs.length > 0 ? (checkedIn / pastRegs.length) * 100 : 0;
    const noShowRate = pastRegs.length > 0 ? ((pastRegs.length - checkedIn) / pastRegs.length) * 100 : 0;

    // Health status
    let health: string;
    if (avgFill >= 70 && avgAtt >= 70 && cancRate < 10) health = t("orgDetail.healthExcellent");
    else if (avgFill >= 50 && avgAtt >= 50 && cancRate < 20) health = t("orgDetail.healthGood");
    else if (avgFill >= 30 || avgAtt >= 30) health = t("orgDetail.healthWarning");
    else health = totalEvents === 0 ? "—" : t("orgDetail.healthCritical");

    return { totalEvents, avgFill, avgAtt, cancRate, noShowRate, health };
  };

  const perfData = filtered.map((org) => ({ ...org, perf: getOrgPerf(org.id) }));

  const sortedPerfData = [...perfData].sort((a, b) => {
    let va = 0, vb = 0;
    if (perfSort === "name") return perfSortDir === "asc" ? a.first_name.localeCompare(b.first_name) : b.first_name.localeCompare(a.first_name);
    if (perfSort === "events") { va = a.perf.totalEvents; vb = b.perf.totalEvents; }
    if (perfSort === "fillRate") { va = a.perf.avgFill; vb = b.perf.avgFill; }
    if (perfSort === "attendanceRate") { va = a.perf.avgAtt; vb = b.perf.avgAtt; }
    return perfSortDir === "asc" ? va - vb : vb - va;
  });

  const toggleSort = (key: SortKey) => {
    if (perfSort === key) setPerfSortDir(perfSortDir === "asc" ? "desc" : "asc");
    else { setPerfSort(key); setPerfSortDir("desc"); }
  };

  const handleExport = () => {
    exportToCsv("organizers", [t("common.name"), t("common.email"), t("users.role"), t("orgDetail.eventsCreated"), t("orgDetail.avgFillRate"), t("orgDetail.avgAttendance")],
      perfData.map((o) => [
        `${o.first_name} ${o.last_name}`, o.email || "", o.roles.join(", "),
        String(o.perf.totalEvents), `${o.perf.avgFill.toFixed(1)}%`, `${o.perf.avgAtt.toFixed(1)}%`,
      ])
    );
    toast.success(t("export.exportCsv"));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t("organizers.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("organizers.subtitle")} ({organizers.length} {t("common.total").toLowerCase()})</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton queryKeys={[["admin-organizers"], ["admin-org-all-events"], ["admin-org-all-regs"]]} />
          <Button variant="outline" size="icon" onClick={handleExport} title={t("export.exportCsv")}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList>
          <TabsTrigger value="list">{t("organizers.title")}</TabsTrigger>
          <TabsTrigger value="performance">{t("orgDetail.performanceView")}</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap gap-4">
                <div className="relative max-w-sm flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder={t("common.search") + "..."} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="w-[180px]">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SelectValue placeholder={t("users.filterByStatus")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">{t("users.allStatuses")}</SelectItem>
                      <SelectItem value="Active">{t("common.active")}</SelectItem>
                      <SelectItem value="Suspended">{t("users.suspended")}</SelectItem>
                      <SelectItem value="Banned">{t("users.banned")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {isLoading ? (
                <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.name")}</TableHead>
                      <TableHead>{t("common.email")}</TableHead>
                      <TableHead>{t("common.phone")}</TableHead>
                      <TableHead>{t("users.role")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead>{t("users.events")}</TableHead>
                      <TableHead>{t("users.joined")}</TableHead>
                      <TableHead>{t("users.lastLogin")}</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((org) => (
                      <TableRow key={org.id} className="cursor-pointer" onClick={() => navigate(`/organizers/${org.id}`)}>
                        <TableCell className="font-medium">{org.first_name} {org.last_name}</TableCell>
                        <TableCell className="text-muted-foreground">{org.email || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{org.phone || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {(org.roles || []).map((r) => (
                              <Badge key={r} variant={r === "admin" ? "default" : r === "organizer" ? "secondary" : "outline"}>{r}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={org.account_status === "Active" ? "outline" : "default"}
                            className={
                              org.account_status === "Active" ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" :
                              org.account_status === "Suspended" ? "bg-yellow-500 hover:bg-yellow-600" :
                              "bg-destructive hover:bg-destructive/90"
                            }
                          >
                            {org.account_status || "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell>{org.eventCount}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{new Date(org.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{org.last_sign_in_at ? new Date(org.last_sign_in_at).toLocaleString() : t("users.never")}</TableCell>
                        <RowActionCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <RowActionButton aria-label="Azioni organizzatore">
                                <MoreHorizontal className="h-4 w-4" />
                              </RowActionButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/organizers/${org.id}`)}>
                                <Search className="h-4 w-4 mr-2" /> {t("users.viewDetails")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(org)}>
                                <Edit2 className="h-4 w-4 mr-2" /> {t("users.editDetails")}
                              </DropdownMenuItem>
                              {org.account_status !== "Suspended" && (
                                <DropdownMenuItem onClick={() => setConfirmAction({ type: "suspend", userId: org.id, userName: `${org.first_name} ${org.last_name}` })}>
                                  <MoreHorizontal className="h-4 w-4 mr-2" /> Suspend Account
                                </DropdownMenuItem>
                              )}
                              {org.account_status === "Suspended" && (
                                <DropdownMenuItem onClick={() => updateStatus.mutate({ userId: org.id, status: "Active" })}>
                                  <Edit2 className="h-4 w-4 mr-2" /> Reactivate Account
                                </DropdownMenuItem>
                              )}
                              {org.account_status !== "Banned" && (
                                <DropdownMenuItem className="text-destructive" onClick={() => setConfirmAction({ type: "ban", userId: org.id, userName: `${org.first_name} ${org.last_name}` })}>
                                  <Trash2 className="h-4 w-4 mr-2" /> Ban User
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-destructive" onClick={() => setConfirmAction({ type: "remove_role", userId: org.id, userName: `${org.first_name} ${org.last_name}` })}>
                                <Trash2 className="h-4 w-4 mr-2" /> {t("organizers.removeRole")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </RowActionCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">{t("organizers.noOrganizers")}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <h3 className="text-lg font-semibold">{t("orgDetail.performanceView")}</h3>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort("name")}>
                      {t("common.name")} <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort("events")}>
                      {t("orgDetail.eventsCreated")} <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort("fillRate")}>
                      {t("orgDetail.avgFillRate")} <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort("attendanceRate")}>
                      {t("orgDetail.avgAttendance")} <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </TableHead>
                    <TableHead>{t("orgDetail.cancellationRate")}</TableHead>
                    <TableHead>{t("orgDetail.noShowRate")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPerfData.map((org) => {
                    const healthColor =
                      org.perf.health === t("orgDetail.healthExcellent") ? "bg-green-500/10 text-green-600 border-green-500/30" :
                      org.perf.health === t("orgDetail.healthGood") ? "bg-blue-500/10 text-blue-600 border-blue-500/30" :
                      org.perf.health === t("orgDetail.healthWarning") ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" :
                      org.perf.health === t("orgDetail.healthCritical") ? "bg-destructive/10 text-destructive border-destructive/30" : "";
                    return (
                      <TableRow key={org.id} className="cursor-pointer" onClick={() => navigate(`/organizers/${org.id}`)}>
                        <TableCell className="font-medium">{org.first_name} {org.last_name}</TableCell>
                        <TableCell>{org.perf.totalEvents}</TableCell>
                        <TableCell>{org.perf.avgFill.toFixed(1)}%</TableCell>
                        <TableCell>{org.perf.avgAtt.toFixed(1)}%</TableCell>
                        <TableCell>{org.perf.cancRate.toFixed(1)}%</TableCell>
                        <TableCell>{org.perf.noShowRate.toFixed(1)}%</TableCell>
                        <TableCell>
                          {org.perf.health !== "—" ? (
                            <Badge variant="outline" className={healthColor}>{org.perf.health}</Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editOrg} onOpenChange={(o) => !o && setEditOrg(null)}>
        <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
          <DialogHeader><DialogTitle>{t("organizers.editOrganizer")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("users.firstName")}</Label><Input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} /></div>
              <div><Label>{t("users.lastName")}</Label><Input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} /></div>
            </div>
            <div><Label>{t("common.phone")}</Label><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
            <div><Label>Bio</Label><Input value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} /></div>
            <div>
              <Label>{t("users.role")}</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="organizer">Organizer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("common.status")}</Label>
              <Select value={editForm.account_status || "Active"} onValueChange={(v: any) => setEditForm({ ...editForm, account_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">{t("common.active")}</SelectItem>
                  <SelectItem value="Suspended">{t("users.suspended")}</SelectItem>
                  <SelectItem value="Banned">{t("users.banned")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOrg(null)}>{t("common.cancel")}</Button>
            <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "remove_role" ? t("organizers.removeRole") : confirmAction?.type === "ban" ? "Ban User" : "Suspend User"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "remove_role"
                ? `${t("organizers.removeConfirm")} ${confirmAction.userName}?`
                : confirmAction?.type === "ban"
                ? `Are you sure you want to ban ${confirmAction?.userName}?`
                : `Are you sure you want to suspend ${confirmAction?.userName}'s account?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.type === "remove_role") removeOrgRole.mutate(confirmAction.userId);
                else if (confirmAction.type === "ban") { updateStatus.mutate({ userId: confirmAction.userId, status: "Banned" }); setConfirmAction(null); }
                else { updateStatus.mutate({ userId: confirmAction.userId, status: "Suspended" }); setConfirmAction(null); }
              }}
            >
              {confirmAction?.type === "remove_role" ? t("organizers.removeRole") : confirmAction?.type === "ban" ? "Ban" : "Suspend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
