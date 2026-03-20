import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MoreHorizontal, Trash2, Edit2, Mail } from "lucide-react";
import RefreshButton from "@/components/RefreshButton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { useLanguage } from "@/i18n/LanguageContext";

interface OrgUser {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  bio: string | null;
  avatar_url: string | null;
  account_status: Database["public"]["Enums"]["account_status"] | null;
  membership_status: string | null;
  membership_id: number | null;
  is_founding_member: boolean;
  created_at: string;
  roles: string[];
  eventCount: number;
  last_sign_in_at: string | null;
}

export default function OrganizersPage() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [viewOrg, setViewOrg] = useState<OrgUser | null>(null);
  const [editOrg, setEditOrg] = useState<OrgUser | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "", last_name: "", phone: "", bio: "",
    account_status: "Active" as Database["public"]["Enums"]["account_status"]
  });
  const [editRole, setEditRole] = useState("organizer");
  const [confirmAction, setConfirmAction] = useState<{ type: "remove_role" | "ban" | "suspend"; userId: string; userName: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: organizers = [], isLoading } = useQuery({
    queryKey: ["admin-organizers"],
    queryFn: async () => {
      const { data: orgRoles } = await supabase.from("user_roles").select("user_id").eq("role", "organizer");
      if (!orgRoles?.length) return [];
      const orgIds = orgRoles.map((r) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("*").in("id", orgIds);
      const { data: events } = await supabase.from("events").select("organizer_id");
      const { data: allRoles } = await supabase.from("user_roles").select("user_id, role").in("user_id", orgIds);

      let authUsers: { id: string; email: string; last_sign_in_at: string | null }[] = [];
      try {
        const res = await supabase.functions.invoke("list-users");
        if (res.data && !res.data.error) authUsers = res.data;
      } catch {}
      const authMap = new Map(authUsers.map((u) => [u.id, u]));

      return (profiles || []).map((p) => ({
        ...p,
        roles: (allRoles || []).filter((r) => r.user_id === p.id).map((r) => r.role) || [],
        eventCount: events?.filter((e) => e.organizer_id === p.id).length || 0,
        email: authMap.get(p.id)?.email || p.email || "—",
        last_sign_in_at: authMap.get(p.id)?.last_sign_in_at || null,
      })) as OrgUser[];
    },
  });

  const { data: orgActivity, isLoading: loadingActivity } = useQuery({
    queryKey: ["admin-org-events", viewOrg?.id],
    queryFn: async () => {
      if (!viewOrg?.id) return [];
      const { data } = await supabase
        .from("events")
        .select("id, title, date, status, spots_taken, spots_total")
        .eq("organizer_id", viewOrg.id)
        .order("date", { ascending: false });
      return data || [];
    },
    enabled: !!viewOrg?.id,
  });

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!editOrg) return;
      const { error } = await supabase.from("profiles").update({
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        phone: editForm.phone,
        bio: editForm.bio,
        account_status: editForm.account_status,
        updated_at: new Date().toISOString(),
      }).eq("id", editOrg.id);
      if (error) throw error;

      const currentRole = editOrg.roles.find((r) => ["admin", "organizer", "user"].includes(r)) || "organizer";
      if (editRole !== currentRole) {
        await supabase.from("user_roles").delete().eq("user_id", editOrg.id).eq("role", currentRole as any);
        await supabase.from("user_roles").insert({ user_id: editOrg.id, role: editRole as any });
      }
    },
    onSuccess: () => {
      toast.success("Organizer updated");
      queryClient.invalidateQueries({ queryKey: ["admin-organizers"] });
      setEditOrg(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: Database["public"]["Enums"]["account_status"] }) => {
      const { error } = await supabase.from("profiles").update({
        account_status: status,
        updated_at: new Date().toISOString(),
      }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["admin-organizers"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeOrgRole = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "organizer" as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Organizer role removed");
      queryClient.invalidateQueries({ queryKey: ["admin-organizers"] });
      setConfirmAction(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (org: OrgUser) => {
    setEditOrg(org);
    setEditForm({
      first_name: org.first_name, last_name: org.last_name,
      phone: org.phone, bio: org.bio || "",
      account_status: org.account_status || "Active"
    });
    setEditRole(org.roles.includes("admin") ? "admin" : org.roles.includes("organizer") ? "organizer" : "user");
  };

  const filtered = organizers.filter((o) => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      `${o.first_name} ${o.last_name}`.toLowerCase().includes(searchLower) ||
      (o.email || "").toLowerCase().includes(searchLower) ||
      (o.phone || "").toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === "All" || o.account_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t("organizers.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("organizers.subtitle")} ({organizers.length} {t("common.total").toLowerCase()})</p>
        </div>
        <RefreshButton queryKeys={[["admin-organizers"]]} />
      </div>

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
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.first_name} {org.last_name}</TableCell>
                    <TableCell className="text-muted-foreground">{org.email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{org.phone || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {org.roles.map((r) => (
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
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewOrg(org)}>
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
                    </TableCell>
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

      {/* View Organizer Details Dialog */}
      <Dialog open={!!viewOrg} onOpenChange={(o) => !o && setViewOrg(null)}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col pl-6 pr-2">
          <DialogHeader className="pr-4">
            <DialogTitle>{t("users.userDetails")}: {viewOrg?.first_name} {viewOrg?.last_name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            {viewOrg && (
              <Tabs defaultValue="profile" className="w-full mt-2">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="profile">{t("users.profileOverview")}</TabsTrigger>
                  <TabsTrigger value="events">{t("users.events")}</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("common.email")}</p>
                      <p className="font-medium">{viewOrg.email || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("common.phone")}</p>
                      <p className="font-medium">{viewOrg.phone || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("users.joined")}</p>
                      <p className="font-medium">{new Date(viewOrg.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("common.status")}</p>
                      <Badge variant={viewOrg.account_status === "Active" ? "outline" : "default"}>
                        {viewOrg.account_status || "Active"}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("users.role")}</p>
                      <div className="flex gap-1 flex-wrap">
                        {viewOrg.roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("users.lastLogin")}</p>
                      <p className="font-medium">{viewOrg.last_sign_in_at ? new Date(viewOrg.last_sign_in_at).toLocaleString() : t("users.never")}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{t("users.events")}</p>
                      <p className="font-medium text-lg">{viewOrg.eventCount}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Membership</p>
                      <Badge variant={viewOrg.membership_status === "Active" ? "outline" : "secondary"}>
                        {viewOrg.membership_status || "None"}
                      </Badge>
                    </div>
                  </div>

                  {viewOrg.bio && (
                    <div className="space-y-1 mt-4">
                      <p className="text-sm text-muted-foreground">Bio</p>
                      <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-md border">{viewOrg.bio}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="events" className="space-y-4 mt-4">
                  {loadingActivity ? (
                    <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
                  ) : !orgActivity || orgActivity.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
                      No events organized yet.
                    </div>
                  ) : (
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Event</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>{t("common.status")}</TableHead>
                            <TableHead>Spots</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orgActivity.map((event) => (
                            <TableRow key={event.id}>
                              <TableCell className="font-medium">{event.title}</TableCell>
                              <TableCell className="text-muted-foreground">{new Date(event.date).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <Badge variant={
                                  event.status === "published" || event.status === "available" ? "default" :
                                  event.status === "cancelled" ? "destructive" : "secondary"
                                }>
                                  {event.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{event.spots_taken}/{event.spots_total}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editOrg} onOpenChange={(o) => !o && setEditOrg(null)}>
        <DialogContent>
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
              <Select
                value={editForm.account_status || "Active"}
                onValueChange={(v: any) => setEditForm({ ...editForm, account_status: v })}
              >
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
                ? `Are you sure you want to ban ${confirmAction?.userName}? They will lose access to the platform.`
                : `Are you sure you want to suspend ${confirmAction?.userName}'s account?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.type === "remove_role") {
                  removeOrgRole.mutate(confirmAction.userId);
                } else if (confirmAction.type === "ban") {
                  updateStatus.mutate({ userId: confirmAction.userId, status: "Banned" });
                  setConfirmAction(null);
                } else {
                  updateStatus.mutate({ userId: confirmAction.userId, status: "Suspended" });
                  setConfirmAction(null);
                }
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
